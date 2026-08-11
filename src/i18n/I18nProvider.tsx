import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { applyDocumentDirection } from './documentDirection'

export type UiLanguage = 'tr' | 'fr' | 'en'

type TranslationParams = Record<string, string | number>

type I18nContextValue = {
  language: UiLanguage
  setLanguage: (language: UiLanguage) => void
  t: (key: string, params?: TranslationParams) => string
}

const LANGUAGE_STORAGE_KEY = 'velora.uiLanguage'

const translations: Record<UiLanguage, Record<string, string>> = {
  tr: {
    'language.tr': 'Türkçe',
    'language.fr': 'Français',
    'language.en': 'English',
    'nav.overview': 'Genel Bakış',
    'nav.dailyWork': 'Günlük İşler',
    'nav.customers': 'Müşteriler',
    'nav.customerRequests': 'Müşteri Talepleri',
    'nav.products': 'Ürünler',
    'nav.orders': 'Siparişler',
    'nav.inventory': 'Stok',
    'nav.production': 'Üretim',
    'nav.costCalculation': 'Maliyet Hesaplama',
    'nav.finance': 'Finans',
    'nav.financeAi': 'Finans Asistanı',
    'nav.users': 'Ekip',
    'nav.usersTitle': 'Ekip, maaş ve izin',
    'overview.shortcuts': 'Hızlı Erişim',
    'overview.shortcutsHint': 'Operasyon ekranına git',
    'overview.case.dailyWork': 'Bekleyen işler ve hızlı aksiyonlar',
    'overview.case.customers': 'Firma kartı, yetkili ve iletişim',
    'overview.case.customerRequests': 'Görüşme kaydı → siparişe dönüşüm',
    'overview.case.products': 'SKU, renk, en ve fiyat listesi',
    'overview.case.orders': 'Onay, teslimat, avans ve tahsilat',
    'overview.case.inventory': 'Depo bakiyesi, giriş ve çıkış',
    'overview.case.production': 'Emir aç, ilerleme güncelle, tamamla',
    'overview.case.costCalculation': 'İplikten 1 adet ve toplam maliyet (DA)',
    'overview.case.finance': 'Kasa, cari bakiye ve tahsilat',
    'overview.case.financeAi': 'Salt okunur finans analizi',
    'overview.case.users': 'Hesaplar, maaş (DZD) ve yıllık izin (30 gün)',
    'common.currency': 'Para birimi',
    'common.notifications': 'Bildirimler',
    'common.noNotifications': 'Yeni bildirim yok.',
    'common.profile': 'Profil menüsü',
    'common.logout': 'Çıkış yap',
    'common.loading': 'Yükleniyor…',
    'common.cancel': 'Vazgeç',
    'common.save': 'Kaydet',
    'common.close': 'Kapat',
    'common.install': 'Uygulamayı yükle',
    'common.installHint':
      'Masaüstü ikonu için: Chrome/Edge menü → “Uygulamayı yükle” / “Install app”. Safari: Paylaş → Ana Ekrana Ekle. HTTPS gerekir.',
    'login.title': 'Hesabınıza giriş yapın',
    'login.description': 'Operasyonlarınızı VEXOR ile güvenle yönetin.',
    'login.email': 'E-posta',
    'login.password': 'Şifre',
    'login.remember': 'Beni hatırla',
    'login.submit': 'Giriş Yap',
    'login.submitting': 'Giriş yapılıyor…',
    'login.error': 'Giriş bilgileri hatalı. Lütfen tekrar deneyin.',
    'login.quick.eyebrow': 'GELİŞTİRME',
    'login.quick.title': 'Hızlı giriş',
    'login.quick.description':
      'Hesaplar arasında geçiş için bir hesap seçin. Şifre yazmanıza gerek yok.',
    'profile.changePhoto': 'Profil fotoğrafını değiştir',
    'profile.removePhoto': 'Fotoğrafı kaldır',
    'profile.photoUpdating': 'Kaydediliyor…',
    'profile.photoError': 'Profil fotoğrafı güncellenemedi.',
    'startup.loading': 'VEXOR ERP hazırlanıyor',
    'startup.description': 'TRIKOMEX operasyon verileri güvenle yükleniyor',
    'role.ADMIN': 'Yönetici',
    'role.OWNER': 'Şirket Sahibi',
    'role.MEMBER': 'Çalışan',
    'role.VIEWER': 'Görüntüleyici',
    'role.ACCOUNTING_OPERATOR': 'Muhasebe Operatörü',
    'role.ACCOUNTING_OPERATIONS': 'Muhasebe & Operasyon',
    'role.PRODUCTION_MANAGER': 'Üretim Müdürü',
  },
  fr: {
    'language.tr': 'Türkçe',
    'language.fr': 'Français',
    'language.en': 'English',
    'nav.overview': 'Vue d’ensemble',
    'nav.dailyWork': 'Travail quotidien',
    'nav.customers': 'Clients',
    'nav.customerRequests': 'Demandes clients',
    'nav.products': 'Produits',
    'nav.orders': 'Commandes',
    'nav.inventory': 'Stock',
    'nav.production': 'Production',
    'nav.costCalculation': 'Calcul de coût',
    'nav.finance': 'Finance',
    'nav.financeAi': 'Assistant financier',
    'nav.users': 'Équipe',
    'nav.usersTitle': 'Équipe, salaire et congé',
    'overview.shortcuts': 'Accès rapide',
    'overview.shortcutsHint': 'Accéder aux opérations',
    'overview.case.dailyWork': 'Tâches en attente et actions rapides',
    'overview.case.customers': 'Fiche client, contact et ville',
    'overview.case.customerRequests': 'Demande → conversion en commande',
    'overview.case.products': 'SKU, couleur, laize et tarifs',
    'overview.case.orders': 'Validation, livraison, acompte, encaissement',
    'overview.case.inventory': 'Soldes dépôt, entrées et sorties',
    'overview.case.production': 'Ouvrir un OF, suivre et terminer',
    'overview.case.costCalculation': 'Coût fil → unité et production (DA)',
    'overview.case.finance': 'Caisse, solde client et encaissements',
    'overview.case.financeAi': 'Analyse financière en lecture seule',
    'overview.case.users': 'Comptes, salaire (DZD) et congé annuel (30 j)',
    'common.currency': 'Devise',
    'common.notifications': 'Notifications',
    'common.noNotifications': 'Aucune nouvelle notification.',
    'common.profile': 'Menu du profil',
    'common.logout': 'Se déconnecter',
    'common.loading': 'Chargement…',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.close': 'Fermer',
    'common.install': 'Installer l’application',
    'common.installHint':
      'Pour l’icône bureau : menu Chrome/Edge → « Installer l’application ». Safari : Partager → Sur l’écran d’accueil. HTTPS requis.',
    'login.title': 'Connectez-vous à votre compte',
    'login.description': 'Gérez vos opérations en toute confiance avec VEXOR.',
    'login.email': 'E-mail',
    'login.password': 'Mot de passe',
    'login.remember': 'Se souvenir de moi',
    'login.submit': 'Se connecter',
    'login.submitting': 'Connexion…',
    'login.error': 'Identifiants incorrects. Veuillez réessayer.',
    'login.quick.eyebrow': 'DÉVELOPPEMENT',
    'login.quick.title': 'Connexion rapide',
    'login.quick.description':
      'Choisissez un compte pour basculer rapidement. Aucun mot de passe à saisir.',
    'profile.changePhoto': 'Changer la photo de profil',
    'profile.removePhoto': 'Supprimer la photo',
    'profile.photoUpdating': 'Enregistrement…',
    'profile.photoError': 'Impossible de mettre à jour la photo de profil.',
    'startup.loading': 'Préparation de VEXOR ERP',
    'startup.description': 'Les données opérationnelles de TRIKOMEX sont chargées en sécurité',
    'role.ADMIN': 'Administrateur',
    'role.OWNER': 'Propriétaire',
    'role.MEMBER': 'Employé',
    'role.VIEWER': 'Lecteur',
    'role.ACCOUNTING_OPERATOR': 'Opérateur comptable',
    'role.ACCOUNTING_OPERATIONS': 'Comptabilité et opérations',
    'role.PRODUCTION_MANAGER': 'Responsable production',
  },
  en: {
    'language.tr': 'Türkçe',
    'language.fr': 'Français',
    'language.en': 'English',
    'nav.overview': 'Overview',
    'nav.dailyWork': 'Daily work',
    'nav.customers': 'Customers',
    'nav.customerRequests': 'Customer requests',
    'nav.products': 'Products',
    'nav.orders': 'Orders',
    'nav.inventory': 'Inventory',
    'nav.production': 'Production',
    'nav.costCalculation': 'Cost calculation',
    'nav.finance': 'Finance',
    'nav.financeAi': 'Finance assistant',
    'nav.users': 'Team',
    'nav.usersTitle': 'Team, salary and leave',
    'overview.shortcuts': 'Quick access',
    'overview.shortcutsHint': 'Open an operations screen',
    'overview.case.dailyWork': 'Pending work and quick actions',
    'overview.case.customers': 'Company card, contact and city',
    'overview.case.customerRequests': 'Request log → convert to order',
    'overview.case.products': 'SKU, color, width and price list',
    'overview.case.orders': 'Confirm, deliver, advance and collect',
    'overview.case.inventory': 'Warehouse balances, in and out',
    'overview.case.production': 'Open orders, update progress, complete',
    'overview.case.costCalculation': 'Yarn to unit and batch cost (DA)',
    'overview.case.finance': 'Cash, customer balance and collections',
    'overview.case.financeAi': 'Read-only finance analysis',
    'overview.case.users': 'Accounts, salary (DZD) and annual leave (30 days)',
    'common.currency': 'Currency',
    'common.notifications': 'Notifications',
    'common.noNotifications': 'No new notifications.',
    'common.profile': 'Profile menu',
    'common.logout': 'Sign out',
    'common.loading': 'Loading…',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.close': 'Close',
    'common.install': 'Install app',
    'common.installHint':
      'For a desktop icon: Chrome/Edge menu → “Install app”. Safari: Share → Add to Home Screen. HTTPS required.',
    'login.title': 'Sign in to your account',
    'login.description': 'Manage your operations confidently with VEXOR.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.remember': 'Remember me',
    'login.submit': 'Sign in',
    'login.submitting': 'Signing in…',
    'login.error': 'Invalid sign-in details. Please try again.',
    'login.quick.eyebrow': 'DEVELOPMENT',
    'login.quick.title': 'Quick sign-in',
    'login.quick.description':
      'Pick an account to switch quickly. No need to type a password.',
    'profile.changePhoto': 'Change profile photo',
    'profile.removePhoto': 'Remove photo',
    'profile.photoUpdating': 'Saving…',
    'profile.photoError': 'Could not update profile photo.',
    'startup.loading': 'Preparing VEXOR ERP',
    'startup.description': 'TRIKOMEX operational data is loading securely',
    'role.ADMIN': 'Administrator',
    'role.OWNER': 'Company owner',
    'role.MEMBER': 'Employee',
    'role.VIEWER': 'Viewer',
    'role.ACCOUNTING_OPERATOR': 'Accounting operator',
    'role.ACCOUNTING_OPERATIONS': 'Accounting and operations',
    'role.PRODUCTION_MANAGER': 'Production manager',
  },
}

const fallbackContext: I18nContextValue = {
  language: 'tr',
  setLanguage: () => undefined,
  t: (key, params) => {
    const template = translations.tr[key] ?? key
    return Object.entries(params ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template,
    )
  },
}

const I18nContext = createContext<I18nContextValue>(fallbackContext)

function initialLanguage(): UiLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return saved === 'fr' || saved === 'en' || saved === 'tr' ? saved : 'tr'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(initialLanguage)
  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
        applyDocumentDirection(nextLanguage)
        setLanguageState(nextLanguage)
      },
      t: (key, params) => {
        const template = translations[language][key] ?? translations.tr[key] ?? key
        return Object.entries(params ?? {}).reduce(
          (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
          template,
        )
      },
    }),
    [language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
