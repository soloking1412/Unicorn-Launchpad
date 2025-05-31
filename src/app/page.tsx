import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Unicorn Factory
          </h1>
          <p className="text-xl mb-8 text-gray-300">
            The Launchpad for AI & Deep-Tech Startups
          </p>
          <div className="space-x-4">
            <Link 
              href="/submit-project" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition-colors"
            >
              Submit Project
            </Link>
            <Link 
              href="/projects" 
              className="bg-transparent border-2 border-purple-600 text-white font-bold py-3 px-8 rounded-full hover:bg-purple-600/10 transition-colors"
            >
              Browse Projects
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <h3 className="text-xl font-semibold mb-4">Submit Your Project</h3>
            <p className="text-gray-300">Pitch your AI startup with video, documentation, and team details.</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <h3 className="text-xl font-semibold mb-4">Community Funding</h3>
            <p className="text-gray-300">Raise funds through bonding curves with automatic price scaling.</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <h3 className="text-xl font-semibold mb-4">Token Launch</h3>
            <p className="text-gray-300">Get your project tokens and start trading on our platform.</p>
          </div>
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Featured Projects</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Project cards will be dynamically populated */}
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <div className="h-48 bg-gray-700 rounded-lg mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="text-gray-300">Be the first to launch your AI project!</p>
          </div>
        </div>
      </section>
    </main>
  );
}
