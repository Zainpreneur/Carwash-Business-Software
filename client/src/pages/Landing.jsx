import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Droplets,
  Sparkles,
  CalendarClock,
  Users,
  Car,
  CreditCard,
  BriefcaseBusiness,
  Boxes,
  BarChart3,
  Receipt,
  ShieldCheck,
  Zap,
  Check,
  CheckCircle2,
  ArrowRight,
  Star,
  ChevronDown,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Clock,
  Waves,
  ListOrdered,
  LifeBuoy,
  Building2,
  Globe,
  Lock,
  TrendingUp,
  Settings,
  Bell,
  Camera,
  QrCode,
  UserCog,
  Package,
  Play,
  ChevronRight,
  Quote,
  Award,
  Rocket,
  HeartHandshake,
  Layers,
  Gauge,
  Smartphone,
  Wifi,
  RefreshCw,
  FileText,
  MessageSquare,
  Truck,
  Timer,
  Target,
  Headphones,
  ThumbsUp,
  Globe2,
  Palette,
  Store,
  BookOpen,
  ExternalLink,
  Share2,
} from 'lucide-react'
import { saasApi } from '../api/resources'

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Waves,
    title: 'Wash-Floor Operations',
    description:
      'Live bay board, queue management, auto bay assignment, quality checks, and a full wash-order lifecycle from queue to checkout.',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  {
    icon: CalendarClock,
    title: 'Online Booking',
    description:
      'Customers book 24/7 from your branded booking page. Real-time slot availability, service selection, and instant confirmation.',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  {
    icon: Users,
    title: 'Customer Directory',
    description:
      '360° customer profiles with vehicle history, loyalty points, visit tracking, and membership status.',
    bg: 'bg-violet-50',
    text: 'text-violet-600',
  },
  {
    icon: CreditCard,
    title: 'Memberships & Billing',
    description:
      'Create wash plans, manage subscriptions, pause/resume/cancel, and bill automatically via Stripe.',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  {
    icon: BriefcaseBusiness,
    title: 'HR & Scheduling',
    description:
      'Employee roster, shift scheduling with clock-in/out, late flags, and leave-request approvals.',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
  },
  {
    icon: Boxes,
    title: 'Inventory & Purchasing',
    description:
      'Supply tracking, stock adjustments, purchase orders, and per-package chemical consumption.',
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
  },
  {
    icon: BarChart3,
    title: 'Reports & Insights',
    description:
      'Revenue trends, booking breakdowns, top services, and live operational insights.',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
  },
  {
    icon: Receipt,
    title: 'Expenses',
    description: 'Categorized expense tracking to keep your finances in check.',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
  },
  {
    icon: LifeBuoy,
    title: 'Support Tickets',
    description:
      'Damage claims, billing disputes, and quality complaints with SLA tracking and comment threads.',
    bg: 'bg-teal-50',
    text: 'text-teal-600',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description:
      'Real-time alerts for queue backups, bay downs, membership payment failures, and more.',
    bg: 'bg-pink-50',
    text: 'text-pink-600',
  },
  {
    icon: Building2,
    title: 'Multi-Branch',
    description:
      'Manage multiple locations from one account. Each branch has its own bays, staff, and stock.',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
  },
  {
    icon: Globe,
    title: 'White-Label Branding',
    description:
      'Your logo, your colors, your domain. Every screen reflects your brand identity.',
    bg: 'bg-brand-50',
    text: 'text-brand-600',
  },
  {
    icon: Globe2,
    title: 'Multi-Tenant SaaS',
    description:
      'Each business is fully isolated with its own data, branding, and team. Scale to hundreds of locations.',
    bg: 'bg-violet-50',
    text: 'text-violet-600',
  },
  {
    icon: Store,
    title: 'Self-Serve Signup',
    description:
      'New businesses register in 60 seconds. Auto-provisioned with branch, bays, price list, and packages.',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create your business',
    description:
      'Sign up in 60 seconds. Your business, first branch, price list, and bays are set up automatically.',
    icon: Building2,
  },
  {
    step: '02',
    title: 'Customize your brand',
    description:
      'Upload your logo, pick your colors. Share your public booking link with customers.',
    icon: Palette,
  },
  {
    step: '03',
    title: 'Invite your team',
    description:
      'Add staff, managers, and admins. Each person gets the right level of access.',
    icon: UserCog,
  },
  {
    step: '04',
    title: 'Run the wash floor',
    description:
      'Queue vehicles, assign bays, track quality checks, and check out customers in real time.',
    icon: Waves,
  },
  {
    step: '05',
    title: 'Customers book online',
    description:
      'Share your booking link. Customers pick services, choose a time, and get instant confirmation.',
    icon: BookOpen,
  },
  {
    step: '06',
    title: 'Grow with data',
    description:
      'Track revenue, memberships, inventory, and expenses. Upgrade your plan as you grow.',
    icon: TrendingUp,
  },
]

const FAQS = [
  {
    q: 'How long does setup take?',
    a: 'Under 5 minutes. Sign up, and we automatically create your business, first branch, service bays, wash packages, and price list. You can start taking bookings immediately.',
  },
  {
    q: 'Can customers book online?',
    a: 'Yes! Every business gets a public booking page at /book/your-slug. Share the link on your website, social media, or print it on receipts. Customers pick services, choose a time slot, and get instant confirmation — no login required.',
  },
  {
    q: 'Can I manage multiple locations?',
    a: 'Yes. Each business can have multiple branches. Each branch has its own bays, staff, stock, and reporting. Switch between branches from the top bar.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — every new business starts on a 14-day trial with full access to all features. No credit card required.',
  },
  {
    q: 'Can I use my own branding?',
    a: 'Absolutely. Upload your logo, pick your brand color, and the entire app re-skins itself — including the public booking page. Your customers see your brand, not ours.',
  },
  {
    q: 'What happens if I outgrow my plan?',
    a: "Upgrade any time from the Business settings page. Your data, members, and configuration carry over instantly — no migration needed.",
  },
  {
    q: 'Do you support Stripe billing?',
    a: 'Yes. Connect your Stripe account to bill membership customers automatically. Without Stripe, memberships run in demo mode locally.',
  },
  {
    q: 'Is my data secure?',
    a: 'Every business is fully isolated at the database level. No other business can ever see your customers, bookings, or financials. Role-based access controls who sees what inside your team.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No long-term contracts. Cancel from your account settings and your data remains accessible until the end of your billing period.',
  },
  {
    q: 'Can I embed the booking page on my website?',
    a: 'Yes! The booking page is a standalone URL you can link to from your website, social media, Google Business profile, or anywhere else. It works on all devices.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Alex Rivera',
    role: 'Owner, Sparkle Wash',
    quote:
      'We went from paper tickets to a fully digital wash floor in one afternoon. The bay board alone saved us hours every day. Our staff picked it up in minutes.',
    avatar: '#2563eb',
    initials: 'AR',
    rating: 5,
  },
  {
    name: 'Maria Chen',
    role: 'Manager, AutoShine Detailing',
    quote:
      'Memberships were a game changer. Recurring revenue went up 40% in the first month. The Stripe integration just works — no manual billing anymore.',
    avatar: '#db2777',
    initials: 'MC',
    rating: 5,
  },
  {
    name: 'James Park',
    role: 'Owner, Suds & Shine (3 locations)',
    quote:
      'Managing three branches used to mean three spreadsheets. Now it is one dashboard. My managers love the mobile view and the branch switcher.',
    avatar: '#0891b2',
    initials: 'JP',
    rating: 5,
  },
  {
    name: 'Sarah Kim',
    role: 'Owner, CleanRide Auto Spa',
    quote:
      'The online booking page is incredible. Customers book 24/7, and we wake up to a full schedule. No more missed calls.',
    avatar: '#16a34a',
    initials: 'SK',
    rating: 5,
  },
]

const INTEGRATIONS = [
  { name: 'Stripe', desc: 'Membership billing', icon: CreditCard, color: 'text-violet-600' },
  { name: 'WhatsApp', desc: 'Customer messaging', icon: MessageSquare, color: 'text-emerald-600' },
  { name: 'QR Scanner', desc: 'Plate scanning', icon: QrCode, color: 'text-blue-600' },
  { name: 'Reports', desc: 'Revenue analytics', icon: BarChart3, color: 'text-amber-600' },
  { name: 'Multi-Branch', desc: 'Location management', icon: Building2, color: 'text-rose-600' },
  { name: 'White-Label', desc: 'Custom branding', icon: Palette, color: 'text-brand-600' },
]

const STATS = [
  { value: '500+', label: 'Car washes' },
  { value: '50K+', label: 'Washes tracked' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9★', label: 'Avg rating' },
]

/* ------------------------------------------------------------------ */
/*  Small reusable components                                         */
/* ------------------------------------------------------------------ */

const SectionLabel = ({ children }) => (
  <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{children}</p>
)

const SectionTitle = ({ children, className = '' }) => (
  <h2 className={`text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl ${className}`}>
    {children}
  </h2>
)

const SectionSub = ({ children, className = '' }) => (
  <p className={`mt-4 text-lg leading-relaxed text-slate-600 ${className}`}>{children}</p>
)

/* ------------------------------------------------------------------ */
/*  Landing page                                                      */
/* ------------------------------------------------------------------ */

const Landing = () => {
  const navigate = useNavigate()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [plans, setPlans] = useState([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    saasApi
      .plans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false))
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goSignup = () => navigate('/signup')
  const goLogin = () => navigate('/login')
  const goBookingDemo = () => navigate('/book/sparkle-wash')

  return (
    <div className="min-h-dvh bg-white text-slate-800 antialiased">
      {/* ============================================================ */}
      {/* NAV                                                          */}
      {/* ============================================================ */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl'
            : 'border-b border-transparent bg-white/60 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/25">
              <Droplets size={20} />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">SudsFlow</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: '#features', label: 'Features' },
              { href: '#booking', label: 'Online Booking' },
              { href: '#how', label: 'How it works' },
              { href: '#pricing', label: 'Pricing' },
              { href: '#faq', label: 'FAQ' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={goLogin} className="btn-secondary hidden sm:inline-flex">
              Sign in
            </button>
            <button onClick={goSignup} className="btn-primary shadow-md shadow-brand-600/20">
              Start free trial
              <ArrowRight size={15} />
            </button>
            <button
              onClick={() => setMobileMenu((o) => !o)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {[
                { href: '#features', label: 'Features' },
                { href: '#booking', label: 'Online Booking' },
                { href: '#how', label: 'How it works' },
                { href: '#pricing', label: 'Pricing' },
                { href: '#faq', label: 'FAQ' },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenu(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
                <button onClick={goLogin} className="btn-secondary w-full">
                  Sign in
                </button>
                <button onClick={goSignup} className="btn-primary w-full">
                  Start free trial
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* HERO                                                         */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white" />
          <div className="absolute -top-40 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-brand-200/30 blur-3xl" />
          <div className="absolute top-20 -left-20 -z-10 h-[400px] w-[400px] rounded-full bg-violet-200/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-white/80 px-4 py-1.5 text-sm font-medium text-brand-700 shadow-sm backdrop-blur">
              <Sparkles size={14} className="text-brand-500" />
              The all-in-one car wash management platform
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl xl:text-7xl">
              Run your car wash{' '}
              <span className="relative">
                <span className="bg-gradient-to-r from-brand-600 via-violet-600 to-brand-600 bg-clip-text text-transparent">
                  like a pro
                </span>
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 300 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 8.5C50 3 100 1 150 5C200 9 250 3 298 7"
                    stroke="url(#underline-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="underline-grad" x1="0" y1="0" x2="300" y2="0">
                      <stop stopColor="#0284c7" />
                      <stop offset="0.5" stopColor="#7c3aed" />
                      <stop offset="1" stopColor="#0284c7" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Bookings, wash-floor operations, memberships, inventory, HR, and
              reporting — all in one place. Plus a{' '}
              <span className="font-semibold text-brand-600">public booking page</span>{' '}
              so customers can book 24/7. Set up in 5 minutes. No credit card required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={goSignup}
                className="group btn-primary px-7 py-3.5 text-base shadow-lg shadow-brand-600/25 transition-all hover:shadow-xl hover:shadow-brand-600/30"
              >
                Start your free trial
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={goBookingDemo}
                className="btn-secondary px-7 py-3.5 text-base"
              >
                <ExternalLink size={16} className="text-brand-600" />
                Try live booking demo
              </button>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              14-day free trial · No credit card · Cancel anytime
            </p>
          </div>

          {/* Hero mockup */}
          <div className="mx-auto mt-16 max-w-5xl lg:mt-20">
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-brand-500/20 to-violet-500/20 blur-2xl" />
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/50">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="mx-auto max-w-xs rounded-md bg-white px-3 py-1 text-center text-xs text-slate-400 shadow-sm">
                      sudsflow.app/t/sparkle-wash
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-0">
                  <div className="hidden border-r border-slate-200 bg-slate-50/50 p-4 lg:col-span-2 lg:block">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
                        <Droplets size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Sparkle Wash</span>
                    </div>
                    {['Dashboard', 'Wash Ops', 'Bookings', 'Customers', 'Memberships', 'Inventory', 'Reports'].map(
                      (item) => (
                        <div
                          key={item}
                          className={`mb-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            item === 'Dashboard'
                              ? 'bg-brand-100 text-brand-700'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {item}
                        </div>
                      )
                    )}
                  </div>
                  <div className="col-span-12 p-5 sm:p-6 lg:col-span-10">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-slate-900">Dashboard</h3>
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Live
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: 'Today Revenue', value: '$1,240', color: 'text-emerald-600' },
                        { label: 'Bookings', value: '18', color: 'text-blue-600' },
                        { label: 'In Queue', value: '4', color: 'text-amber-600' },
                        { label: 'Members', value: '127', color: 'text-violet-600' },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
                          <p className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700">Revenue (14 days)</p>
                          <span className="text-xs font-medium text-emerald-600">+12.5%</span>
                        </div>
                        <div className="flex items-end gap-1.5">
                          {[40, 55, 35, 70, 60, 85, 50, 75, 65, 90, 45, 80, 70, 95].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-t bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
                              style={{ height: `${h * 0.55}px` }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="mb-3 text-xs font-semibold text-slate-700">Bay Status</p>
                        <div className="space-y-2.5">
                          {[
                            { name: 'Bay 1', status: 'In Wash', color: 'bg-violet-500' },
                            { name: 'Bay 2', status: 'Ready', color: 'bg-emerald-500' },
                            { name: 'Bay 3', status: 'Queued', color: 'bg-amber-500' },
                            { name: 'Bay 4', status: 'Free', color: 'bg-slate-300' },
                          ].map((b) => (
                            <div key={b.name} className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-600">{b.name}</span>
                              <span className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${b.color}`} />
                                <span className="text-slate-500">{b.status}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* STATS BAR                                                    */}
      {/* ============================================================ */}
      <section className="border-y border-slate-200 bg-slate-50/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 sm:grid-cols-4 sm:px-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-slate-900 sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURES                                                     */}
      {/* ============================================================ */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel>Features</SectionLabel>
          <SectionTitle className="mt-3">
            Everything you need to run your car wash
          </SectionTitle>
          <SectionSub>
            From the wash floor to the back office — one platform replaces
            spreadsheets, whiteboards, and disconnected tools.
          </SectionSub>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-100/40"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${f.bg} ${f.text} transition-transform duration-300 group-hover:scale-110`}>
                <f.icon size={24} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* ONLINE BOOKING SHOWCASE                                       */}
      {/* ============================================================ */}
      <section id="booking" className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionLabel>Online booking</SectionLabel>
              <SectionTitle className="mt-3">Let customers book 24/7 — no phone calls needed</SectionTitle>
              <SectionSub>
                Every business gets a branded public booking page. Share the link
                on your website, social media, or Google Business profile.
                Customers pick services, choose a time, and get instant confirmation.
              </SectionSub>
              <ul className="mt-8 space-y-4">
                {[
                  { icon: Globe, text: 'Public booking URL: yoursite.com/book/your-business' },
                  { icon: Clock, text: 'Real-time slot availability — shows empty and filled times' },
                  { icon: Car, text: 'Service selection with pricing and duration' },
                  { icon: CheckCircle2, text: 'Instant booking confirmation with reference number' },
                  { icon: Smartphone, text: 'Fully mobile-responsive — works on any device' },
                  { icon: Palette, text: 'Branded with your logo and colors' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <item.icon size={16} />
                    </div>
                    <span className="pt-1 text-sm font-medium text-slate-700">{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex gap-3">
                <button onClick={goBookingDemo} className="btn-primary shadow-lg shadow-brand-600/20">
                  <ExternalLink size={16} />
                  Try live booking demo
                </button>
                <button onClick={goSignup} className="btn-secondary">
                  Get your booking page
                </button>
              </div>
            </div>

            {/* Booking page mockup */}
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-emerald-500/10 to-brand-500/10 blur-2xl" />
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-200/50">
                <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
                      <Droplets size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Sparkle Wash</p>
                      <p className="text-[10px] text-slate-500">Book your wash online</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  {/* Step indicator */}
                  <div className="mb-4 flex items-center justify-center gap-2">
                    {['Services', 'Date & Time', 'Details'].map((label, i) => (
                      <div key={label} className="flex items-center gap-2">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            i === 0 ? 'text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                          style={i === 0 ? { backgroundColor: '#0284c7' } : {}}
                        >
                          {i + 1}
                        </div>
                        <span className={`hidden text-xs sm:inline ${i === 0 ? 'font-medium text-slate-900' : 'text-slate-400'}`}>
                          {label}
                        </span>
                        {i < 2 && <div className="h-0.5 w-4 bg-slate-200 sm:w-8" />}
                      </div>
                    ))}
                  </div>

                  {/* Service list mock */}
                  <div className="space-y-2">
                    {[
                      { name: 'Express Wash', price: 15, dur: 20, selected: true },
                      { name: 'Standard Wash & Vacuum', price: 25, dur: 35, selected: false },
                      { name: 'Deluxe Wash', price: 40, dur: 50, selected: false },
                      { name: 'Full Detailing', price: 120, dur: 150, selected: false },
                    ].map((s) => (
                      <div
                        key={s.name}
                        className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                          s.selected
                            ? 'border-brand-500 bg-brand-50 shadow-sm'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded border-2 ${
                              s.selected ? 'border-transparent text-white' : 'border-slate-300'
                            }`}
                            style={s.selected ? { backgroundColor: '#0284c7' } : {}}
                          >
                            {s.selected && <Check size={10} />}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-900">{s.name}</p>
                            <p className="text-[10px] text-slate-400">{s.dur} min</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-900">${s.price}</span>
                      </div>
                    ))}
                  </div>

                  {/* Time slots mock */}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-slate-700">Available times</p>
                    <div className="mb-2 flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded border border-slate-300 bg-white" /> Available
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded bg-slate-200" /> Booked
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { time: '08:00', avail: false },
                        { time: '08:30', avail: false },
                        { time: '09:00', avail: true, selected: true },
                        { time: '09:30', avail: true },
                        { time: '10:00', avail: true },
                        { time: '10:30', avail: false },
                        { time: '11:00', avail: true },
                        { time: '11:30', avail: true },
                      ].map((s) => (
                        <div
                          key={s.time}
                          className={`rounded-lg border px-2 py-1.5 text-center text-xs font-medium ${
                            !s.avail
                              ? 'border-slate-200 bg-slate-100 text-slate-400'
                              : s.selected
                              ? 'border-transparent text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                          style={s.selected ? { backgroundColor: '#0284c7' } : {}}
                        >
                          {s.time}
                          {!s.avail && <span className="block text-[9px]">Booked</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW IT WORKS                                                 */}
      {/* ============================================================ */}
      <section id="how" className="relative overflow-hidden bg-slate-50 py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 opacity-40">
          <div className="absolute top-0 left-1/4 h-72 w-72 rounded-full bg-brand-200/30 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <SectionLabel>How it works</SectionLabel>
            <SectionTitle className="mt-3">Up and running in six steps</SectionTitle>
            <SectionSub>
              No complex setup. No IT department. Just sign up and start washing.
            </SectionSub>
          </div>

          <div className="relative mt-16">
            <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 lg:block" />

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {HOW_IT_WORKS.map((h, i) => (
                <div key={h.step} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg shadow-brand-600/10 ring-1 ring-brand-100 transition-transform duration-300 hover:scale-105">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
                      <h.icon size={24} />
                    </div>
                  </div>
                  <span className="mt-4 text-xs font-bold tracking-widest text-brand-600">{h.step}</span>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{h.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">{h.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* DEEP DIVE — WASH FLOOR                                       */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionLabel>Wash floor</SectionLabel>
            <SectionTitle className="mt-3">See every bay, every car, every status — live</SectionTitle>
            <SectionSub>
              The wash-floor board shows all bays, queue positions, wash progress,
              and quality checks in real time. Auto-assign bays by package type.
              Quality check fails? Send it back for rework automatically.
            </SectionSub>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Layers, text: 'Live 6-bay status board with color-coded states' },
                { icon: Zap, text: 'Auto bay assignment by wash package lane' },
                { icon: RefreshCw, text: 'Quality check pass/fail with rework loop' },
                { icon: UserCog, text: 'Per-role floor views: My Queue, Checkout, Wash Ops' },
                { icon: MessageSquare, text: 'Customer-ready notifications via WhatsApp' },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <item.icon size={16} />
                  </div>
                  <span className="pt-1 text-sm font-medium text-slate-700">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-brand-500/10 to-violet-500/10 blur-2xl" />
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Bay 1', status: 'In Wash', car: 'ABC-1234', color: 'bg-violet-100 border-violet-200 text-violet-700' },
                  { name: 'Bay 2', status: 'Quality Check', car: 'XYZ-5678', color: 'bg-cyan-100 border-cyan-200 text-cyan-700' },
                  { name: 'Bay 3', status: 'Ready', car: 'DEF-9012', color: 'bg-emerald-100 border-emerald-200 text-emerald-700' },
                  { name: 'Bay 4', status: 'Queued', car: 'GHI-3456', color: 'bg-amber-100 border-amber-200 text-amber-700' },
                  { name: 'Bay 5', status: 'Free', car: '—', color: 'bg-slate-50 border-slate-200 text-slate-400' },
                  { name: 'Bay 6', status: 'Free', car: '—', color: 'bg-slate-50 border-slate-200 text-slate-400' },
                ].map((b) => (
                  <div key={b.name} className={`rounded-xl border p-3 transition-transform hover:scale-105 ${b.color}`}>
                    <p className="text-xs font-bold">{b.name}</p>
                    <p className="mt-1 text-[11px] font-medium">{b.status}</p>
                    <p className="mt-0.5 text-[10px] opacity-70">{b.car}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">Queue (3 waiting)</p>
                  <span className="text-[10px] text-slate-400">Avg wait: 12 min</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { plate: 'JKL-7890', service: 'Deluxe Wash', wait: '~8 min' },
                    { plate: 'MNO-1234', service: 'Express Wash', wait: '~15 min' },
                    { plate: 'PQR-5678', service: 'Full Detail', wait: '~25 min' },
                  ].map((q) => (
                    <div
                      key={q.plate}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs shadow-sm"
                    >
                      <span className="font-medium text-slate-700">{q.plate}</span>
                      <span className="text-slate-500">{q.service}</span>
                      <span className="text-slate-400">{q.wait}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* DEEP DIVE — CUSTOMERS & MEMBERSHIPS                          */}
      {/* ============================================================ */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                    JS
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">John Smith</p>
                    <p className="text-xs text-slate-500">Member since Jan 2025 · Gold Plan</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Visits', value: '24', icon: Car },
                    { label: 'Points', value: '1,480', icon: Star },
                    { label: 'Spent', value: '$1,240', icon: Receipt },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-slate-50 p-3 text-center">
                      <s.icon size={16} className="mx-auto mb-1 text-slate-400" />
                      <p className="text-lg font-bold text-slate-900">{s.value}</p>
                      <p className="text-[10px] font-medium text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Recent washes</p>
                  {[
                    { date: 'Mar 12', service: 'Deluxe Wash', price: '$40' },
                    { date: 'Mar 5', service: 'Express Wash', price: '$15' },
                    { date: 'Feb 28', service: 'Full Detail', price: '$120' },
                  ].map((w) => (
                    <div
                      key={w.date}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="text-slate-500">{w.date}</span>
                      <span className="font-medium text-slate-700">{w.service}</span>
                      <span className="font-semibold text-slate-900">{w.price}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-brand-600" />
                    <span className="text-xs font-semibold text-brand-700">Gold Membership</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Renews Apr 1 · $49/mo · 4 washes included
                  </p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <SectionLabel>Customers & memberships</SectionLabel>
              <SectionTitle className="mt-3">Turn one-time washes into recurring revenue</SectionTitle>
              <SectionSub>
                Create membership plans, track subscriptions, and bill automatically.
                Customer profiles show full wash history, loyalty points, and
                membership status — all in one view.
              </SectionSub>
              <ul className="mt-8 space-y-4">
                {[
                  { icon: CreditCard, text: 'Membership plans with pause, resume, and cancel' },
                  { icon: Zap, text: 'Stripe billing integration for automatic charges' },
                  { icon: Star, text: 'Loyalty points credited on every wash' },
                  { icon: Users, text: 'Customer 360° view with full history' },
                  { icon: MessageSquare, text: 'Membership dunning and welcome messages via WhatsApp' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <item.icon size={16} />
                    </div>
                    <span className="pt-1 text-sm font-medium text-slate-700">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* INTEGRATIONS                                                 */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <SectionLabel>Integrations</SectionLabel>
              <SectionTitle className="mt-3 text-2xl sm:text-3xl">
                Works with the tools you already use
              </SectionTitle>
              <SectionSub className="text-base">
                Connect Stripe for billing, WhatsApp for customer messaging, and
                scan plates with your phone camera. Everything syncs in real time.
              </SectionSub>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {INTEGRATIONS.map((int) => (
                <div
                  key={int.name}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ${int.color}`}>
                    <int.icon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{int.name}</p>
                    <p className="text-xs text-slate-500">{int.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PRICING                                                      */}
      {/* ============================================================ */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel>Pricing</SectionLabel>
          <SectionTitle className="mt-3">Simple, transparent pricing</SectionTitle>
          <SectionSub>
            Start with a 14-day free trial. Upgrade or downgrade at any time. No
            hidden fees.
          </SectionSub>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plansLoading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-8">
                  <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-10 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="mt-6 space-y-3">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    ))}
                  </div>
                </div>
              ))
            : plans.map((p, i) => {
                const isPopular = i === 1
                return (
                  <div
                    key={p.code}
                    className={`relative rounded-2xl border p-7 transition-all duration-300 ${
                      isPopular
                        ? 'border-brand-500 bg-white shadow-2xl shadow-brand-100/60 ring-1 ring-brand-500 scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-brand-200 hover:shadow-xl hover:shadow-slate-200/50'
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
                        Most popular
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-slate-900">{p.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold text-slate-900">${p.priceMonthly}</span>
                      <span className="text-sm font-medium text-slate-500">/month</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {p.maxLocations} branch{p.maxLocations !== 1 ? 'es' : ''} · {p.maxStaff} staff ·{' '}
                      {p.maxCustomers?.toLocaleString()} customers
                    </p>
                    <ul className="mt-7 space-y-3">
                      {Object.entries(p.features || {}).map(([key, on]) => (
                        <li
                          key={key}
                          className={`flex items-center gap-2.5 text-sm ${
                            on ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {on ? (
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                              <Check size={12} className="text-emerald-600" />
                            </div>
                          ) : (
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
                              <X size={12} className="text-slate-400" />
                            </div>
                          )}
                          <span className={on ? '' : 'line-through opacity-60'}>
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={goSignup}
                      className={`mt-8 w-full py-3 text-base font-semibold ${
                        isPopular ? 'btn-primary shadow-lg shadow-brand-600/20' : 'btn-secondary'
                      }`}
                    >
                      {isPopular ? 'Start free trial' : 'Get started'}
                    </button>
                  </div>
                )
              })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </section>

      {/* ============================================================ */}
      {/* TESTIMONIALS                                                 */}
      {/* ============================================================ */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <SectionLabel>Testimonials</SectionLabel>
            <SectionTitle className="mt-3">Loved by car wash owners</SectionTitle>
            <SectionSub>
              Don't take our word for it — hear from the people running their
              business with SudsFlow.
            </SectionSub>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="group relative rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50"
              >
                <Quote size={32} className="absolute right-6 top-6 text-slate-100 transition-colors group-hover:text-brand-100" />
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-700">"{t.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
                    style={{ backgroundColor: t.avatar }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FAQ                                                          */}
      {/* ============================================================ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="text-center">
          <SectionLabel>FAQ</SectionLabel>
          <SectionTitle className="mt-3">Frequently asked questions</SectionTitle>
          <SectionSub className="text-base">
            Everything you need to know before getting started.
          </SectionSub>
        </div>
        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {FAQS.map((f, i) => (
            <div key={i} className="px-6">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-base font-medium text-slate-900">{f.q}</span>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 transition-all ${
                    openFaq === i ? 'bg-brand-100 text-brand-600 rotate-180' : 'text-slate-400'
                  }`}
                >
                  <ChevronDown size={16} />
                </div>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openFaq === i ? 'max-h-40 pb-5' : 'max-h-0'
                }`}
              >
                <p className="text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* CTA BANNER                                                   */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-brand-700 to-violet-700 px-6 py-16 text-center shadow-2xl shadow-brand-600/25 sm:px-12 sm:py-20">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Rocket size={28} className="text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              Ready to transform your car wash?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">
              Join hundreds of car wash owners who run their business with SudsFlow.
              Setup takes 5 minutes. Customers can book online from day one.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={goSignup}
                className="group rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-brand-700 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                Start your free trial
                <ArrowRight size={18} className="ml-2 inline-block transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={goBookingDemo}
                className="rounded-xl border border-white/30 bg-white/10 px-8 py-3.5 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                Try booking demo
              </button>
            </div>
            <p className="mt-5 text-sm text-brand-200">
              14-day free trial · No credit card · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
                  <Droplets size={18} />
                </div>
                <span className="text-lg font-bold text-slate-900">SudsFlow</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
                The all-in-one car wash management platform. Run your wash floor,
                bookings, memberships, inventory, and more — all from one dashboard.
                Customers can book online 24/7.
              </p>
              <div className="mt-5 flex items-center gap-3">
                {[
                  { icon: Mail, href: 'mailto:hello@sudsflow.app' },
                  { icon: Phone, href: 'tel:+1234567890' },
                  { icon: Globe, href: '#' },
                  { icon: Share2, href: '#' },
                ].map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-600"
                  >
                    <s.icon size={16} />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li><a href="#features" className="transition-colors hover:text-brand-600">Features</a></li>
                <li><a href="#booking" className="transition-colors hover:text-brand-600">Online Booking</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-brand-600">Pricing</a></li>
                <li><a href="#how" className="transition-colors hover:text-brand-600">How it works</a></li>
                <li><a href="#faq" className="transition-colors hover:text-brand-600">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Company</p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li><a href="#" className="transition-colors hover:text-brand-600">About us</a></li>
                <li><a href="#" className="transition-colors hover:text-brand-600">Blog</a></li>
                <li><a href="#" className="transition-colors hover:text-brand-600">Careers</a></li>
                <li><a href="#" className="transition-colors hover:text-brand-600">Contact</a></li>
                <li><a href="#" className="transition-colors hover:text-brand-600">Partners</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Get started</p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li>
                  <button onClick={goSignup} className="transition-colors hover:text-brand-600">
                    Create account
                  </button>
                </li>
                <li>
                  <button onClick={goLogin} className="transition-colors hover:text-brand-600">
                    Sign in
                  </button>
                </li>
                <li>
                  <button onClick={goBookingDemo} className="transition-colors hover:text-brand-600">
                    Try booking demo
                  </button>
                </li>
                <li><a href="#" className="transition-colors hover:text-brand-600">Privacy policy</a></li>
                <li><a href="#" className="transition-colors hover:text-brand-600">Terms of service</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} SudsFlow. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <a href="#" className="hover:text-slate-600">Privacy</a>
              <a href="#" className="hover:text-slate-600">Terms</a>
              <a href="#" className="hover:text-slate-600">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* MOBILE STICKY CTA                                            */}
      {/* ============================================================ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <button onClick={goSignup} className="btn-primary w-full py-3 text-base shadow-lg shadow-brand-600/20">
          Start free trial
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default Landing
