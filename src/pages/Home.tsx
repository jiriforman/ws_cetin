import { Link } from 'react-router-dom';
import { Terminal, Zap, Users, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWorkshop } from '@/contexts/WorkshopContext';
import narcosLogo from '@/assets/narcos-logo.png';
import { sanitizeHtml } from '@/lib/sanitize';

const Home = () => {
  const { sections } = useWorkshop();
  const homeSection = sections.find((s) => s.pageKey === 'home');

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <img 
              src={narcosLogo} 
              alt="AI in Project Management: NARCOS edition"
              className="max-w-xl w-full mx-auto opacity-80"
            />
            
            <div
              className="prose prose-invert max-w-none text-center mx-auto [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(homeSection?.contentRTF || '') }}
            />

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Link to="/phases">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-primary font-display text-lg uppercase tracking-wider px-8 py-6 text-xl shadow-[0_0_30px_rgba(255,0,0,0.5)]">
                  <Terminal className="mr-2 h-6 w-6" />
                  Enter Operation
                </Button>
              </Link>
              <Link to="/teams">
                <Button size="lg" variant="outline" className="border-2 border-secondary text-secondary hover:bg-secondary/20 font-display text-lg uppercase tracking-wider px-8 py-6 text-xl">
                  <Trophy className="mr-2 h-6 w-6" />
                  Cartel Rankings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/ai-tools">
            <Card className="bg-card border-border p-4 hover:border-primary/50 transition-all group cursor-pointer">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/20 rounded group-hover:animate-pulse-glow">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-primary uppercase tracking-wide">AI Arsenal</h3>
                </div>
                <p className="text-sm text-muted-foreground font-condensed">
                  Your weapons of choice: Gemini, Claude, ChatGPT, NotebookLM. Each tool a key to unlock project dominance.
                </p>
              </div>
            </Card>
          </Link>

          <Link to="/teams">
            <Card className="bg-card border-border p-4 hover:border-secondary/50 transition-all group cursor-pointer">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-secondary/20 rounded group-hover:animate-pulse-glow">
                    <Users className="h-4 w-4 text-secondary" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-secondary uppercase tracking-wide">Cartel Operations</h3>
                </div>
                <p className="text-sm text-muted-foreground font-condensed">
                  Trust no one but your team. Collaborate, strategize, compete. Only the strongest cartels survive.
                </p>
              </div>
            </Card>
          </Link>

          <Link to="/phases">
            <Card className="bg-card border-border p-4 hover:border-accent/50 transition-all group cursor-pointer">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/20 rounded group-hover:animate-pulse-glow">
                    <Trophy className="h-4 w-4 text-accent" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-accent uppercase tracking-wide">Operation Phases</h3>
                </div>
                <p className="text-sm text-muted-foreground font-condensed">
                  Four deadly phases. Discovery. Planning. Execution. Delivery. Time is your enemy. Precision is survival.
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 container mx-auto px-4">
        <Card className="bg-card border-primary/30 p-12 text-center max-w-4xl mx-auto">
          <h2 className="narcos-title text-4xl md:text-5xl font-bold mb-4 text-primary">
            ¿Estás Listo?
          </h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto font-condensed">
            The operation begins now. Access your cartel's dashboard with your unique token. The stakes are high. Failure is not an option.
          </p>
          <Link to="/ai-tools">
            <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/20 font-display uppercase tracking-wider">
              View Arsenal
            </Button>
          </Link>
        </Card>
      </section>
    </div>
  );
};

export default Home;
