import { Link, useLocation } from 'react-router-dom';
import { Home, Target, Wrench, Trophy, Info, Shield, BookOpen } from 'lucide-react';
import FontSelector from './FontSelector';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { isLearningsPageEnabled } from '@/lib/learnings';

const Navigation = () => {
  const location = useLocation();
  const { sections } = useWorkshop();
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/phases', label: 'Enter Operation', icon: Target },
    { path: '/ai-tools', label: 'AI Arsenal', icon: Wrench },
    { path: '/teams', label: 'Cartel Rankings', icon: Trophy },
    ...(isLearningsPageEnabled(sections) ? [{ path: '/learnings', label: 'Learnings', icon: BookOpen }] : []),
    { path: '/about', label: 'About', icon: Info },
    { path: '/admin', label: 'Admin', icon: Shield },
  ];

  const isActive = (path: string) => location.pathname === path;

  // The Negotiation Room pages pretend to be outside sites: no Narcos navigation there
  if (location.pathname.startsWith('/negotiation')) return <FontSelector floating />;
  // The link-only /live big-screen dashboard is shown fullscreen without the menu
  if (location.pathname === '/live') return null;

  return (
    <nav className="border-b border-neon-green/30 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 min-h-16 py-2">
          <Link to="/" className="flex items-center space-x-2 group">
            <Home className="h-6 w-6 text-primary group-hover:animate-pulse-glow" />
            <span className="narcos-title text-2xl text-primary">
              NARCOS
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-0.5 md:gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                aria-label={label}
                aria-current={isActive(path) ? 'page' : undefined}
                className={`flex items-center space-x-2 px-3 md:px-4 py-2 rounded transition-all ${
                  isActive(path)
                    ? 'bg-primary/20 text-primary border border-primary/50 text-glow'
                    : 'text-muted-foreground hover:text-primary hover:bg-muted/50'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
            <FontSelector />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
