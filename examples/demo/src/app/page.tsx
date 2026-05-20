export default function Home() {
  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">🚀 Now in Public Beta</span>
          <h1 className="hero-title">
            Ship Your SaaS
            <br />
            <span className="hero-highlight">In Days, Not Months</span>
          </h1>
          <p className="hero-subtitle">
            The ultimate Next.js boilerplate for indie hackers. Authentication,
            payments, emails, and a beautiful landing page — all wired up and
            ready to customize.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary">
              Start Free Trial
            </button>
            <button className="btn btn-secondary">
              View Demo
            </button>
          </div>
          <p className="hero-note">No credit card required · 14-day free trial</p>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="features-header">
          <h2 className="features-title">Everything You Need</h2>
          <p className="features-subtitle">
            Stop reinventing the wheel. We have built the foundations so you can
            focus on what matters — your product.
          </p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🔐</span>
            <h3 className="feature-card-title">Authentication</h3>
            <p className="feature-card-desc">
              Magic links, social login, and passwordless auth via NextAuth.js.
              Secure and ready in minutes.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">💳</span>
            <h3 className="feature-card-title">Payments</h3>
            <p className="feature-card-desc">
              Stripe integration with checkout sessions, webhooks, and
              subscription management built-in.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📧</span>
            <h3 className="feature-card-title">Emails</h3>
            <p className="feature-card-desc">
              Transactional email templates with Resend. Welcome flows, password
              resets, and drip sequences.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📊</span>
            <h3 className="feature-card-title">Analytics</h3>
            <p className="feature-card-desc">
              Plausible analytics dashboard and conversion tracking. Know your
              numbers from day one.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🌐</span>
            <h3 className="feature-card-title">SEO Optimized</h3>
            <p className="feature-card-desc">
              Metadata, sitemaps, Open Graph, and structured data. Your pages
              rank while you build.
            </p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🎨</span>
            <h3 className="feature-card-title">UI Components</h3>
            <p className="feature-card-desc">
              A growing library of copy-paste components. Buttons, cards,
              modals, and more — all with Tailwind.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Launch?</h2>
          <p className="cta-desc">
            Join 2,000+ indie hackers who shipped their SaaS with ShipFast.
            Start building today.
          </p>
          <button className="btn btn-primary btn-lg">
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">⚡ ShipFast</span>
            <p className="footer-brand-desc">
              The boilerplate for makers who ship.
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4 className="footer-col-title">Product</h4>
              <a href="#">Features</a>
              <a href="#">Pricing</a>
              <a href="#">Changelog</a>
            </div>
            <div className="footer-col">
              <h4 className="footer-col-title">Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
            </div>
            <div className="footer-col">
              <h4 className="footer-col-title">Legal</h4>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 ShipFast. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
