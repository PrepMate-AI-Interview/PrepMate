# PrepMate Feature — Subscription & Payment Processing

## 1. Overview
PrepMate provides a simulated multi-channel checkout workflow (`backend.Controllers.PaymentController`) allowing candidates to upgrade to Pro tier access for unlimited practice sessions and in-depth AI analytics.

---

## 2. API Contract

### 2.1 Process Payment
- **Route:** `POST /api/payment/process`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body (MoMo Example):**
  ```json
  {
    "user": "user_1791211132570",
    "plan": "pro",
    "method": "momo",
    "amount": 199000,
    "momoPhone": "0987654321",
    "transactionId": "MOMO_TX_987654321"
  }
  ```
- **Validation Rules:**
  - `user`: Must match the authenticated caller identity (or caller must have `admin` role). Cross-user payment submission is rejected with `403 Forbidden`.
  - `method`: Supported methods include `card`, `momo`, `zalopay`, `stripe`.
  - Method-specific fields are strictly required (e.g. `CardName`/`CardLast4` for card, `MomoPhone`/`TransactionId` for MoMo).
- **Response (`200 OK`):**
  ```json
  {
    "message": "Thanh toán thành công qua MoMo.",
    "transaction": {
      "id": "tx_1791211456000",
      "user": "user_1791211132570",
      "plan": "pro",
      "method": "momo",
      "amount": 199000,
      "status": "completed"
    }
  }
  ```

---

## 3. Account Provisioning
Upon successful transaction processing:
- `user.Subscription` transitions from `"free"` to `"pro"`.
- `user.SubscriptionDate` is set to the current UTC timestamp.
- `user.SubscriptionExpiry` is extended by 30 days.
- The transaction record is appended to the thread-safe `FileDb.Transactions` collection.
