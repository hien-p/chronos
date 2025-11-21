import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FeatureGrid from './components/FeatureGrid';
import VaultInterface from './components/VaultInterface';
import Footer from './components/Footer';
import MatrixBackground from './components/MatrixBackground';

function App() {
  return (
    <main className="relative min-h-screen text-white overflow-hidden selection:bg-neon-blue selection:text-black">
      <MatrixBackground />
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
