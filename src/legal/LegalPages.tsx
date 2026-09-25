import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import packages from 'virtual:licenses'
import { SITE_NAME, SITE_URL, type PageMeta } from '../seo'
import { tools } from '../tools/registry'
import { CONTACT_EMAIL, COPYRIGHT_SINCE, GOVERNING_LAW, LEGAL_UPDATED, REPO_URL, SITE_OWNER } from '../site.config'

export interface InfoPage {
  meta: PageMeta
  /** Short name for footer links. */
  label: string
  Component: () => ReactNode
}

const siteHost = SITE_URL.replace(/^https?:\/\//, '')

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer noopener">
      an issue on GitHub
    </a>
  )
}

function Page({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated?: boolean; children: ReactNode }) {
  return (
    <article className="info-page">
      <p className="eyebrow">
        <Link to="/">All tools</Link> / {eyebrow}
      </p>
      <h1 className="tool-title">{title}</h1>
      {updated && <p className="muted info-updated">Last updated {LEGAL_UPDATED}</p>}
      <div className="info-body">{children}</div>
    </article>
  )
}

const networkTools = () => tools.filter((t) => t.network)

function Privacy() {
  return (
    <Page eyebrow="Privacy" title="Privacy Policy" updated>
      <p>
        {SITE_NAME} ({siteHost}) is run by {SITE_OWNER}. This page explains what happens to your data when you use the
        site. The short version: the tools run in your browser, we have no accounts, no ads and no cookies, and we never
        see what you type, paste, scan or upload.
      </p>

      <h2>What you put into the tools</h2>
      <p>
        Text, files, images, PDFs, camera and microphone input are processed by JavaScript on your own device. They are
        not uploaded to {SITE_NAME} and we have no server that could store them. Closing the tab clears them.
      </p>
      <p>A few tools reach the network, and only when you use them:</p>
      <ul>
        {networkTools().map((t) => (
          <li key={t.slug}>
            <Link to={`/${t.slug}`}>{t.name}</Link>: {t.network}
          </li>
        ))}
      </ul>
      <p>
        Those requests go straight from your browser to the service named, under that service's own privacy policy.
        Links you choose to open, such as a map link in the EXIF tool, take you to other sites with their own policies.
      </p>

      <h2>Camera, microphone and screen</h2>
      <p>
        Tools like the QR reader, webcam and mic test, audio visualizer and screen recorder ask your browser for access
        first, and you can refuse or revoke it at any time in your browser settings. The feed stays on your device.
        Recordings are only saved if you download them.
      </p>

      <h2>Settings saved in your browser</h2>
      <p>
        Some tools remember small preferences in your browser's local storage so they are there next time: recent emoji,
        Pomodoro settings, the time zones you picked and your typing-test best scores. This data never leaves your
        device, we cannot read it, and you can delete it by clearing site data for {siteHost}. We do not set cookies.
      </p>

      <h2>Hosting and visitor statistics</h2>
      <p>
        The site is hosted on Cloudflare Pages. Like any web host, Cloudflare processes technical data such as your IP
        address, browser type and the page requested in order to deliver the site and protect it from abuse. See{' '}
        <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer noopener">
          Cloudflare's privacy policy
        </a>
        .
      </p>
      <p>
        We use Cloudflare Web Analytics to count visits. It does not use cookies, local storage or fingerprinting, it
        does not track you across sites, and we only see totals such as page views, referring sites, countries and
        page speed. It is configured not to collect data from visitors in the European Union.
      </p>

      <h2>What we don't do</h2>
      <ul>
        <li>No accounts, sign-ups or newsletters.</li>
        <li>No advertising, ad trackers or selling of data.</li>
        <li>No cookies and no cookie banner, because there is nothing to consent to.</li>
      </ul>

      <h2>Children</h2>
      <p>
        The site is a general audience tool collection. We do not knowingly collect personal information from anyone,
        including children.
      </p>

      <h2>Your rights</h2>
      <p>
        Because we hold no personal data about you, there is usually nothing for us to access, correct or delete. For
        data Cloudflare processes as our host, you can also contact Cloudflare directly. Questions about this policy go
        to <Contact />.
      </p>

      <h2>Changes</h2>
      <p>
        If a new tool or service changes what is described here, we will update this page and the date at the top.
      </p>
    </Page>
  )
}

function Terms() {
  return (
    <Page eyebrow="Terms" title="Terms of Use" updated>
      <p>
        These terms apply when you use {SITE_NAME} ({siteHost}), run by {SITE_OWNER}. By using the site you agree to
        them. If you don't agree, please don't use the site.
      </p>

      <h2>Using the tools</h2>
      <p>
        The tools are free for personal and commercial use. You don't need an account. Please don't use them to break
        the law, to attack or overload other people's systems (for example with the CORS or HTTP checkers), or to try to
        disrupt the site itself.
      </p>

      <h2>Your content and results</h2>
      <p>
        What you put into a tool, and what it produces, such as a QR code, a converted file or formatted code, belongs to
        you. We claim no rights over it and never receive it. You are responsible for having the right to use whatever
        you process.
      </p>

      <h2>No professional advice</h2>
      <p>
        Calculators, converters and simulations are for general information and learning. Results for health, finance,
        engineering, security or legal questions (for example BMI, loans, interest or password strength) are estimates,
        not professional advice. Check anything important with a qualified person.
      </p>

      <h2>No warranty</h2>
      <p>
        The site is provided "as is" and "as available". We work to make the tools accurate, but we don't promise that
        they are error-free, always available, or suitable for any particular purpose. Keep your own copy of anything
        important before converting or editing it.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, {SITE_OWNER} is not liable for any loss or damage, including lost data, profits or
        business, arising from use of or inability to use the site or its results.
      </p>

      <h2>Third-party services</h2>
      <p>
        A few tools send requests to other services (see the <Link to="/privacy">Privacy Policy</Link>). Those services
        have their own terms, and we are not responsible for them.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The site's design, text and code are © {SITE_OWNER}. Open-source libraries, icons and fonts belong to their
        authors and are used under their licences, listed on the <Link to="/licenses">licences page</Link>.
      </p>

      <h2>Changes and law</h2>
      <p>
        We may change the tools or these terms at any time; the date above shows the latest version. These terms are
        governed by the laws of {GOVERNING_LAW}. Questions go to <Contact />.
      </p>
    </Page>
  )
}

function Licenses() {
  return (
    <Page eyebrow="Licences" title="Copyright and licences">
      <h2>{SITE_NAME}</h2>
      <p>
        © {COPYRIGHT_SINCE} {SITE_OWNER}. All rights reserved. The source code is published on{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>{' '}
        so you can see how the tools work, which does not by itself grant a licence to reuse it.
      </p>
      <p>Anything you create with the tools is yours.</p>

      <h2>Icons and fonts</h2>
      <ul>
        <li>
          Icons: <a href="https://majesticons.com" target="_blank" rel="noreferrer noopener">Majesticons</a> by Gerrit
          Halfmann, MIT licence.
        </li>
        <li>
          Fonts: Bricolage Grotesque by Mathieu Triay, and JetBrains Mono by JetBrains, both under the SIL Open Font
          Licence 1.1, self-hosted via Fontsource.
        </li>
      </ul>

      <h2>Open-source software</h2>
      <p>
        {SITE_NAME} is built with the open-source packages below. Thank you to their authors. The full licence text of
        every package is in <a href="/third-party-licenses.txt">third-party-licenses.txt</a>.
      </p>
      <table className="info-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Version</th>
            <th>Licence</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((p) => (
            <tr key={`${p.name}@${p.version}`}>
              <td>{p.url ? <a href={p.url} target="_blank" rel="noreferrer noopener">{p.name}</a> : p.name}</td>
              <td>{p.version}</td>
              <td>{p.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  )
}

function About() {
  return (
    <Page eyebrow="About" title={`About ${SITE_NAME}`}>
      <p>
        {SITE_NAME} is a growing collection of {tools.length} small web tools and interactive simulations, made by{' '}
        {SITE_OWNER}. Every tool is free, needs no sign-up, and runs in your browser so your data stays on your device.
      </p>
      <h2>Contact</h2>
      <p>
        Found a bug, or want a tool added? Write to <Contact />.
      </p>
      <h2>More</h2>
      <ul>
        <li>
          <Link to="/privacy">Privacy Policy</Link>
        </li>
        <li>
          <Link to="/terms">Terms of Use</Link>
        </li>
        <li>
          <Link to="/licenses">Copyright and licences</Link>
        </li>
      </ul>
    </Page>
  )
}

const meta = (path: string, title: string, description: string): PageMeta => ({
  title: `${title} | ${SITE_NAME}`,
  description,
  path,
  image: '/og-image.png',
})

/** Site information pages, keyed by path. Each is prerendered and listed in the footer. */
export const infoPages: Record<string, InfoPage> = {
  '/about': {
    label: 'About',
    meta: meta('/about', `About ${SITE_NAME}`, `What ${SITE_NAME} is, who makes it, and how to report a bug or ask for a new free browser tool.`),
    Component: About,
  },
  '/privacy': {
    label: 'Privacy',
    meta: meta('/privacy', 'Privacy Policy', `How ${SITE_NAME} handles your data: tools run in your browser, no cookies, no accounts, no ads, and cookieless visit counts.`),
    Component: Privacy,
  },
  '/terms': {
    label: 'Terms',
    meta: meta('/terms', 'Terms of Use', `The terms for using ${SITE_NAME}'s free online tools: acceptable use, ownership of your results, no warranty and liability.`),
    Component: Terms,
  },
  '/licenses': {
    label: 'Licences',
    meta: meta('/licenses', 'Copyright and Licences', `Copyright notice for ${SITE_NAME} and the licences of the open-source libraries, icons and fonts it is built with.`),
    Component: Licenses,
  },
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="Site information">
        {Object.entries(infoPages).map(([path, p]) => (
          <Link key={path} to={path}>
            {p.label}
          </Link>
        ))}
      </nav>
      <p>
        © {COPYRIGHT_SINCE} {SITE_OWNER}
      </p>
    </footer>
  )
}
