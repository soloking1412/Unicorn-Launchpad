import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 animate-gradient">
            Unicorn Factory
          </h1>
          <p className="text-xl md:text-2xl mb-12 text-gray-300 leading-relaxed">
            The Launchpad for AI & Deep-Tech Startups
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
            <Link 
              href="/submit-project" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
            >
              Submit Project
            </Link>
            <Link 
              href="/projects" 
              className="bg-transparent border-2 border-purple-600 text-white font-bold py-4 px-8 rounded-full hover:bg-purple-600/10 transition-all duration-300 transform hover:scale-105"
            >
              Browse Projects
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-32">
        <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-gray-800/30 backdrop-blur-sm p-8 rounded-2xl border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-4">Submit Your Project</h3>
            <p className="text-gray-300 leading-relaxed">Pitch your AI startup with video, documentation, and team details.</p>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm p-8 rounded-2xl border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-4">Community Funding</h3>
            <p className="text-gray-300 leading-relaxed">Raise funds through bonding curves with automatic price scaling.</p>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm p-8 rounded-2xl border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-4">Token Launch</h3>
            <p className="text-gray-300 leading-relaxed">Get your project tokens and start trading on our platform.</p>
          </div>
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="container mx-auto px-4 py-32">
        <h2 className="text-4xl font-bold text-center mb-16 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Featured Projects</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-gray-800/30 backdrop-blur-sm p-6 rounded-2xl border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 transform hover:-translate-y-1">
            <div className="h-48 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl mb-6 flex items-center justify-center">
              <svg className="w-16 h-16 text-purple-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="text-gray-300">Be the first to launch your AI project!</p>
          </div>
        </div>
      </section>
    </main>
  );
}
