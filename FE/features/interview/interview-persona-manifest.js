/**
 * PrepMate — Interviewer Persona SSOT Manifest & Audio Asset Registry
 * Work Item: WI-INTERVIEW-UI-01
 * 
 * Centralized Single Source of Truth for:
 * - Interviewer personality types (professional, friendly, balanced)
 * - Profile metadata (name, title, avatar initials, gradient, focus, tone, approach)
 * - Static greeting audio asset reference & playback controller
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PrepMatePersonas = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PERSONA_MANIFEST = {
    professional: {
      id: "professional",
      name: "Trần Minh Vũ",
      title: "Giám đốc Kỹ thuật & Tuyển dụng Cấp cao",
      companyRole: "Lead Technical Interviewer",
      badgeLabel: "Chuyên nghiệp & Thử thách",
      badgeClass: "badge-professional",
      avatarInitials: "MV",
      avatarBg: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
      accentColor: "#1d4ed8",
      tone: "Nghiêm túc, điềm tĩnh, chuẩn mực",
      styleDescription: "Đặt câu hỏi trực diện, đào sâu vào bản chất kiến trúc hệ thống, tư duy phản biện và khả năng xử lý bài toán thực tế dưới áp lực cao.",
      approach: "STAR chuyên sâu · Đào sâu 'Tại sao' · Đánh giá tư duy gốc",
      suitableFor: "Senior, Tech Lead, Chuyên gia kỹ thuật, Quản lý dự án",
      recommendedIndustry: "Công nghệ thông tin, Kỹ thuật, Tài chính",
      voiceId: "yTpM1yhZn6oZ0xMLpLFT",
      defaultVoiceId: "yTpM1yhZn6oZ0xMLpLFT",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/d6c8ae0789cb475597797358f8fe6c23/voices/yTpM1yhZn6oZ0xMLpLFT/cc7e6684-35b1-4dae-b514-99c5e937d103.mp3",
      greetingText: "Xin chào bạn, tôi là Trần Minh Vũ, Giám đốc Chuyên môn. Tôi sẽ đồng hành và đánh giá chuyên sâu kiến trúc cũng như tư duy kỹ thuật của bạn trong buổi phỏng vấn hôm nay.",
      audioAssetUrl: "assets/audio/personas/professional_greeting.mp3",
      audioAvailable: false, // Verified: No static mp3 asset exists currently in repo
      fallbackVoiceGender: "male",
      pitch: 1.00,
      rate: 1.00,
    },
    friendly: {
      id: "friendly",
      name: "Lê Lan Anh",
      title: "Trưởng phòng Nhân sự & Văn hóa Doanh nghiệp",
      companyRole: "People & Culture Interviewer",
      badgeLabel: "Thân thiện & Khích lệ",
      badgeClass: "badge-friendly",
      avatarInitials: "LA",
      avatarBg: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
      accentColor: "#059669",
      tone: "Cởi mở, gần gũi, khích lệ",
      styleDescription: "Tạo không khí trò chuyện tự nhiên, giúp ứng viên giảm căng thẳng và thể hiện rõ nhất tính cách, khả năng thích ứng và tiềm năng phát triển.",
      approach: "Hành vi & Tình huống · Lắng nghe tích cực · Đánh giá Culture-fit",
      suitableFor: "Fresher, Junior, Mid-level, Chuyển ngành, Client-facing",
      recommendedIndustry: "Nhân sự, Marketing, Dịch vụ khách hàng, Kinh doanh",
      voiceId: "3BUMLmVV2cgPJQ2pAwBa",
      defaultVoiceId: "3BUMLmVV2cgPJQ2pAwBa",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/d6c8ae0789cb475597797358f8fe6c23/voices/3BUMLmVV2cgPJQ2pAwBa/38c418af-5880-4c19-96d5-604a6426cc06.mp3",
      greetingText: "Chào bạn! Tôi là Lê Lan Anh đến từ bộ phận Nhân sự. Buổi phỏng vấn hôm nay là cơ hội để hai bên trò chuyện cởi mở về kinh nghiệm và định hướng phát triển của bạn. Hãy thật tự tin nhé!",
      audioAssetUrl: "assets/audio/personas/friendly_greeting.mp3",
      audioAvailable: false,
      fallbackVoiceGender: "female",
      pitch: 1.00,
      rate: 1.00,
    },
    balanced: {
      id: "balanced",
      name: "Nguyễn Hoàng Nam",
      title: "Quản lý Dự án & Kỹ thuật Nghiệp vụ",
      companyRole: "Balanced Operations Interviewer",
      badgeLabel: "Cân bằng & Thực tế",
      badgeClass: "badge-balanced",
      avatarInitials: "HN",
      avatarBg: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
      accentColor: "#4f46e5",
      tone: "Rõ ràng, khách quan, tôn trọng",
      styleDescription: "Kết hợp hài hòa giữa kiểm tra năng lực chuyên môn và đánh giá kỹ năng phối hợp đội ngũ, quản lý thời gian và thái độ làm việc.",
      approach: "Tình huống thực tế · Cân bằng Hard/Soft Skills · Phản hồi đa chiều",
      suitableFor: "Mid-level, Product Owner, Scrum Master, Vị trí liên chức năng",
      recommendedIndustry: "Quản trị kinh doanh, E-commerce, Vận hành, Logistics",
      voiceId: "GbyYOHheg88tlJBFNEYY",
      defaultVoiceId: "GbyYOHheg88tlJBFNEYY",
      previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/d6c8ae0789cb475597797358f8fe6c23/voices/GbyYOHheg88tlJBFNEYY/e4785e02-99bc-4867-b871-dcd5e816848a.mp3",
      greetingText: "Xin chào, tôi là Nguyễn Hoàng Nam. Chúng ta sẽ cùng trao đổi về các bài toán thực tế, kỹ năng giải quyết vấn đề và sự phối hợp đội ngũ của bạn.",
      audioAssetUrl: "assets/audio/personas/balanced_greeting.mp3",
      audioAvailable: false,
      fallbackVoiceGender: "male",
      pitch: 1.00,
      rate: 1.00,
    }
  };

  let _activeAudio = null;
  let _activePersonaId = null;

  function getPersona(id) {
    return PERSONA_MANIFEST[id] || PERSONA_MANIFEST.professional;
  }

  function getAllPersonas() {
    return Object.values(PERSONA_MANIFEST);
  }

  function stopGreeting() {
    if (_activeAudio) {
      try {
        _activeAudio.pause();
        _activeAudio.currentTime = 0;
      } catch (e) { }
      _activeAudio = null;
    }
    const prevId = _activePersonaId;
    _activePersonaId = null;
    return prevId;
  }

  /**
   * Attempts to play static audio greeting for persona.
   * If asset is not available, executes onUnavailable callback gracefully.
   */
  async function playGreeting(personaId, callbacks = {}) {
    const { onStart, onEnd, onError, onUnavailable } = callbacks;
    stopGreeting();

    const persona = getPersona(personaId);
    if (!persona) return false;

    // Check manifest availability flag
    if (!persona.audioAvailable) {
      if (typeof onUnavailable === "function") {
        onUnavailable(persona);
      }
      return false;
    }

    try {
      const audio = new Audio(persona.audioAssetUrl);
      _activeAudio = audio;
      _activePersonaId = personaId;

      audio.onplay = () => {
        if (typeof onStart === "function") onStart(persona);
      };

      audio.onended = () => {
        _activeAudio = null;
        _activePersonaId = null;
        if (typeof onEnd === "function") onEnd(persona);
      };

      audio.onerror = (err) => {
        _activeAudio = null;
        _activePersonaId = null;
        if (typeof onUnavailable === "function") {
          onUnavailable(persona, err);
        } else if (typeof onError === "function") {
          onError(persona, err);
        }
      };

      await audio.play();
      return true;
    } catch (err) {
      _activeAudio = null;
      _activePersonaId = null;
      if (typeof onUnavailable === "function") {
        onUnavailable(persona, err);
      } else if (typeof onError === "function") {
        onError(persona, err);
      }
      return false;
    }
  }

  function getActivePlayingPersonaId() {
    return _activePersonaId;
  }

  return {
    MANIFEST: PERSONA_MANIFEST,
    getPersona,
    getAllPersonas,
    playGreeting,
    stopGreeting,
    getActivePlayingPersonaId
  };
});
