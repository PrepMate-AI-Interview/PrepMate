#!/usr/bin/env node
/**
 * PREPMATE — SECURE INITIAL ADMIN PROVISIONING UTILITY
 * 
 * Generates a unique, cryptographically random password for the initial
 * administrator account ('user_admin') and injects the PBKDF2 hash directly
 * into the target database file without committing credentials to Git.
 * 
 * Usage:
 *   node scripts/bootstrap-admin.js [/path/to/db.json]
 *   node scripts/bootstrap-admin.js --db /var/prepmate/data/db.json
 *   node scripts/bootstrap-admin.js --password "ExplicitCustomPassword"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs() {
  const args = process.argv.slice(2);
  let dbPath = process.env.DATABASE_FILE_PATH || '';
  let password = process.env.PREPMATE_ADMIN_PASSWORD || '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      dbPath = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i];
    } else if (!args[i].startsWith('--') && !dbPath) {
      dbPath = args[i];
    }
  }

  if (!dbPath) {
    dbPath = path.resolve(__dirname, '../BE/data/db.json');
  }

  return { dbPath: path.resolve(dbPath), explicitPassword: password };
}

function generateSecurePassword(length = 20) {
  // Safe charset without ambiguous characters
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()-_=+';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const subkey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `${salt.toString('base64')}.${subkey.toString('base64')}`;
}

function main() {
  const { dbPath, explicitPassword } = parseArgs();

  console.log('===============================================================');
  console.log('   PREPMATE — SECURE INITIAL ADMIN PROVISIONING                ');
  console.log('===============================================================\n');

  if (!fs.existsSync(dbPath)) {
    console.error(`[ERROR] Target database file not found at: ${dbPath}`);
    console.error('Vui lòng tạo tệp database từ template trước khi chạy:');
    console.error(`  cp BE/data/db.example.json "${dbPath}"`);
    process.exit(1);
  }

  let dbData;
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    dbData = JSON.parse(raw);
  } catch (err) {
    console.error(`[ERROR] Failed to read or parse JSON at ${dbPath}: ${err.message}`);
    process.exit(1);
  }

  if (!dbData.Users || typeof dbData.Users !== 'object') {
    console.error('[ERROR] Database schema invalid: Collection "Users" is missing.');
    process.exit(1);
  }

  if (!dbData.Users.user_admin) {
    console.error('[ERROR] Database schema invalid: User "user_admin" is missing.');
    process.exit(1);
  }

  // Security Guard: Only allow bootstrap when PasswordHash is strictly the locked sentinel.
  // Refuse execution if the account has already been provisioned to prevent accidental/unauthorized password resets.
  const SENTINEL_LOCK = 'LOCKED_INITIAL_ADMIN_ACCOUNT_PROVISION_REQUIRED';
  const currentHash = dbData.Users.user_admin.PasswordHash;

  if (currentHash !== SENTINEL_LOCK) {
    console.error('[ERROR] Thao tác bị từ chối: Tài khoản "user_admin" đã được cấp mật khẩu từ trước.');
    console.error(`Giá trị PasswordHash hiện tại không khớp với sentinel an toàn "${SENTINEL_LOCK}".`);
    console.error('Để bảo vệ hệ thống khỏi việc vô tình hoặc cố ý ghi đè/reset mật khẩu quản trị viên, bootstrap-admin từ chối thực thi.');
    process.exit(1);
  }

  const finalPassword = explicitPassword && explicitPassword.trim().length >= 8
    ? explicitPassword.trim()
    : generateSecurePassword(20);

  const passwordHash = hashPassword(finalPassword);

  // Update admin record
  dbData.Users.user_admin.PasswordHash = passwordHash;
  dbData.Users.user_admin.Password = '';
  dbData.Users.user_admin.UpdatedAt = new Date().toISOString();

  // Atomic write protocol:
  // 1. Locate temp file in the EXACT same directory to guarantee same filesystem mount/volume.
  // 2. Write and fsync to guarantee data is physically committed to storage before directory entry swap.
  // 3. Atomically replace destination via fs.renameSync (POSIX rename(2) / Windows MoveFileExW with replace).
  // 4. On any failure: clean up temporary file and leave original database completely untouched.
  // IMPORTANT: copyFileSync is strictly forbidden as in-place streaming truncates destination and violates atomicity.
  const dbDir = path.dirname(dbPath);
  const tempPath = path.join(dbDir, `.${path.basename(dbPath)}.${process.pid}.${Date.now()}.tmp`);
  const serialized = JSON.stringify(dbData, null, 2);

  let fd = null;
  try {
    fd = fs.openSync(tempPath, 'w');
    fs.writeSync(fd, serialized, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    fs.renameSync(tempPath, dbPath);
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) {}
    }
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
    console.error(`[ERROR] Thao tác ghi database nguyên tử thất bại: ${err.message}`);
    console.error('Tệp cơ sở dữ liệu gốc được bảo vệ nguyên vẹn không bị sửa đổi hay hư hại.');
    process.exit(1);
  }

  console.log('[SUCCESS] Tài khoản quản trị đã được khởi tạo thông tin đăng nhập thành công!\n');
  console.log(`• Đường dẫn database : ${dbPath}`);
  console.log(`• User ID             : ${dbData.Users.user_admin.Id}`);
  console.log(`• Tên đăng nhập       : ${dbData.Users.user_admin.Username}`);
  console.log(`• Email quản trị      : ${dbData.Users.user_admin.Email}`);
  console.log(`• Mật khẩu quản trị   : ${finalPassword}\n`);
  console.log('---------------------------------------------------------------');
  console.log('LƯU Ý QUAN TRỌNG:');
  console.log('1. Hãy sao chép và lưu trữ mật khẩu trên vào Password Manager an toàn.');
  console.log('2. Mật khẩu này KHÔNG được ghi vào log hệ thống hay tệp cấu hình nào.');
  console.log('3. Mật khẩu sẽ KHÔNG hiển thị lại sau khi kết thúc phiên này.');
  console.log('===============================================================\n');
}

main();
