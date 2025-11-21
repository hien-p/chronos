import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FeatureGrid from './components/FeatureGrid';
import VaultInterface from './components/VaultInterface';
import Footer from './components/Footer';
import ShaderBackground from './components/ShaderBackground';

function App() {
  return (
    <main className="relative min-h-screen text-white overflow-hidden selection:bg-neon-blue selection:text-black">
      <ShaderBackground />
      <Navbar />

      <div className="relative z-10">
        <Hero />
        <VaultInterface />
        <FeatureGrid />
        <Footer />
      </div>
    </main>
  );
}

export default App;
