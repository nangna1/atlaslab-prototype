import { DEFAULT_LOCALE, type Locale } from "./config";

export type Dictionary = {
  landing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    signupCta: string;
    features: { title: string; description: string }[];
    footer: string;
  };
  login: {
    subtitle: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    forgotPassword: string;
    signupTenant: string;
  };
  signupTenant: {
    eyebrow: string;
    title: string;
    subtitle: string;
    nomEtablissement: string;
    slug: string;
    slugHint: string;
    adminNom: string;
    adminEmail: string;
    adminPassword: string;
    submit: string;
    submitting: string;
    slugTakenError: string;
    genericError: string;
    sentMessage: string;
    backToLogin: string;
  };
  forgotPassword: {
    subtitle: string;
    email: string;
    submit: string;
    submitting: string;
    sentMessage: string;
    backToLogin: string;
    genericError: string;
  };
  resetPassword: {
    subtitle: string;
    newPassword: string;
    confirmPassword: string;
    mismatchError: string;
    submit: string;
    submitting: string;
  };
};

const fr: Dictionary = {
  landing: {
    eyebrow: "LMS & laboratoires virtuels",
    title:
      "La plateforme LMS et laboratoires virtuels pour l'enseignement technique et professionnel",
    subtitle:
      "Cours, quiz, devoirs, séances en direct et simulations réelles — une seule plateforme pour chaque établissement.",
    cta: "Se connecter",
    signupCta: "Inscrire mon établissement",
    features: [
      {
        title: "Laboratoires virtuels",
        description:
          "Simulation SPICE (électronique) et logique numérique, 100% dans le navigateur, sans matériel physique.",
      },
      {
        title: "Suivi de progression",
        description:
          "Tableau de bord par établissement : activité des élèves et des professeurs, journalière ou hebdomadaire.",
      },
      {
        title: "Quiz & devoirs",
        description: "Quiz auto-corrigés, devoirs rendus et notés, présence aux séances en direct.",
      },
      {
        title: "Multi-établissements",
        description:
          "Chaque établissement personnalise son logo, sa couleur et ses certificats de fin de cours.",
      },
    ],
    footer: "AtlasLab",
  },
  login: {
    subtitle: "Connexion à votre espace",
    email: "Email",
    password: "Mot de passe",
    submit: "Se connecter",
    submitting: "Connexion...",
    forgotPassword: "Mot de passe oublié ?",
    signupTenant: "Nouvel établissement ? Inscrivez-le",
  },
  signupTenant: {
    eyebrow: "Nouvel établissement",
    title: "Inscrire votre établissement",
    subtitle: "Créez votre espace AtlasLab en quelques instants — aucune approbation manuelle requise.",
    nomEtablissement: "Nom de l'établissement",
    slug: "Identifiant (URL)",
    slugHint: "Utilisé en interne pour identifier votre établissement, sans espaces ni accents.",
    adminNom: "Votre nom",
    adminEmail: "Votre email",
    adminPassword: "Mot de passe",
    submit: "Créer mon établissement",
    submitting: "Création...",
    slugTakenError: "Cet identifiant est déjà pris, essayez-en un autre.",
    genericError: "Impossible de créer l'établissement, réessayez.",
    sentMessage:
      "Votre demande a été envoyée. Un administrateur AtlasLab doit l'approuver avant que vous puissiez vous connecter — vous recevrez un email dès que ce sera fait.",
    backToLogin: "← Retour à la connexion",
  },
  forgotPassword: {
    subtitle: "Mot de passe oublié",
    email: "Email",
    submit: "Envoyer le lien de réinitialisation",
    submitting: "Envoi...",
    sentMessage: "Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.",
    backToLogin: "← Retour à la connexion",
    genericError: "Une erreur est survenue, réessayez plus tard.",
  },
  resetPassword: {
    subtitle: "Nouveau mot de passe",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    mismatchError: "Les deux mots de passe ne correspondent pas.",
    submit: "Changer le mot de passe",
    submitting: "Enregistrement...",
  },
};

const en: Dictionary = {
  landing: {
    eyebrow: "LMS & virtual labs",
    title: "The LMS and virtual labs platform for technical and vocational education",
    subtitle:
      "Courses, quizzes, assignments, live sessions and real simulations — one platform for every institution.",
    cta: "Sign in",
    signupCta: "Register my institution",
    features: [
      {
        title: "Virtual labs",
        description: "SPICE (electronics) and digital logic simulation, 100% in the browser, no physical equipment.",
      },
      {
        title: "Progress tracking",
        description: "Per-institution dashboard: student and teacher activity, daily or weekly.",
      },
      {
        title: "Quizzes & assignments",
        description: "Self-graded quizzes, submitted and graded assignments, live session attendance.",
      },
      {
        title: "Multi-institution",
        description: "Each institution customizes its logo, brand color and course completion certificates.",
      },
    ],
    footer: "AtlasLab",
  },
  login: {
    subtitle: "Sign in to your account",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in...",
    forgotPassword: "Forgot your password?",
    signupTenant: "New institution? Register it",
  },
  signupTenant: {
    eyebrow: "New institution",
    title: "Register your institution",
    subtitle: "Create your AtlasLab space in a few moments — no manual approval required.",
    nomEtablissement: "Institution name",
    slug: "Identifier (URL)",
    slugHint: "Used internally to identify your institution, no spaces or accents.",
    adminNom: "Your name",
    adminEmail: "Your email",
    adminPassword: "Password",
    submit: "Create my institution",
    submitting: "Creating...",
    slugTakenError: "This identifier is already taken, try another one.",
    genericError: "Could not create the institution, please try again.",
    sentMessage:
      "Your request has been sent. An AtlasLab administrator must approve it before you can sign in — you'll receive an email once that's done.",
    backToLogin: "← Back to sign in",
  },
  forgotPassword: {
    subtitle: "Forgot password",
    email: "Email",
    submit: "Send reset link",
    submitting: "Sending...",
    sentMessage: "If an account exists with this email, a reset link has just been sent to it.",
    backToLogin: "← Back to sign in",
    genericError: "Something went wrong, please try again later.",
  },
  resetPassword: {
    subtitle: "New password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    mismatchError: "The two passwords do not match.",
    submit: "Change password",
    submitting: "Saving...",
  },
};

const ar: Dictionary = {
  landing: {
    eyebrow: "منصة تعليمية ومختبرات افتراضية",
    title: "منصة التعليم الإلكتروني والمختبرات الافتراضية للتعليم التقني والمهني",
    subtitle: "دورات، اختبارات، واجبات، حصص مباشرة ومحاكاة حقيقية — منصة واحدة لكل مؤسسة.",
    cta: "تسجيل الدخول",
    signupCta: "سجّل مؤسستك",
    features: [
      {
        title: "مختبرات افتراضية",
        description: "محاكاة SPICE (الإلكترونيات) والمنطق الرقمي، 100٪ في المتصفح، دون أي معدات فعلية.",
      },
      {
        title: "متابعة التقدم",
        description: "لوحة تحكم لكل مؤسسة: نشاط الطلاب والأساتذة، يوميًا أو أسبوعيًا.",
      },
      {
        title: "اختبارات وواجبات",
        description: "اختبارات تُصحَّح تلقائيًا، واجبات مُسلَّمة ومقيَّمة، وحضور الحصص المباشرة.",
      },
      {
        title: "متعدد المؤسسات",
        description: "كل مؤسسة تخصص شعارها ولونها وشهادات إتمام الدورات الخاصة بها.",
      },
    ],
    footer: "AtlasLab",
  },
  login: {
    subtitle: "تسجيل الدخول إلى حسابك",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submit: "تسجيل الدخول",
    submitting: "جارٍ تسجيل الدخول...",
    forgotPassword: "هل نسيت كلمة المرور؟",
    signupTenant: "مؤسسة جديدة؟ سجّلها",
  },
  signupTenant: {
    eyebrow: "مؤسسة جديدة",
    title: "تسجيل مؤسستك",
    subtitle: "أنشئ مساحة AtlasLab الخاصة بك في لحظات — دون الحاجة إلى موافقة يدوية.",
    nomEtablissement: "اسم المؤسسة",
    slug: "المعرّف (الرابط)",
    slugHint: "يُستخدم داخليًا لتعريف مؤسستك، دون مسافات أو رموز خاصة.",
    adminNom: "اسمك",
    adminEmail: "بريدك الإلكتروني",
    adminPassword: "كلمة المرور",
    submit: "إنشاء مؤسستي",
    submitting: "جارٍ الإنشاء...",
    slugTakenError: "هذا المعرّف مُستخدم بالفعل، جرّب معرّفًا آخر.",
    genericError: "تعذّر إنشاء المؤسسة، يرجى المحاولة مرة أخرى.",
    sentMessage:
      "تم إرسال طلبك. يجب أن يوافق عليه أحد مسؤولي AtlasLab قبل أن تتمكن من تسجيل الدخول — ستتلقى بريدًا إلكترونيًا بمجرد الموافقة.",
    backToLogin: "← العودة إلى تسجيل الدخول",
  },
  forgotPassword: {
    subtitle: "نسيت كلمة المرور",
    email: "البريد الإلكتروني",
    submit: "إرسال رابط إعادة التعيين",
    submitting: "جارٍ الإرسال...",
    sentMessage: "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فقد تم للتو إرسال رابط إعادة التعيين إليه.",
    backToLogin: "← العودة إلى تسجيل الدخول",
    genericError: "حدث خطأ ما، يرجى المحاولة مرة أخرى لاحقًا.",
  },
  resetPassword: {
    subtitle: "كلمة مرور جديدة",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    mismatchError: "كلمتا المرور غير متطابقتين.",
    submit: "تغيير كلمة المرور",
    submitting: "جارٍ الحفظ...",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}
