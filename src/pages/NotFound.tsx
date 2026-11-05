import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Terminal, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="bg-card/80 border-destructive/50 p-12 text-center max-w-md">
        <div className="space-y-6">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-destructive animate-pulse-glow" />
          </div>
          
          <div className="space-y-2">
            <h1 className="font-display text-6xl font-bold text-destructive text-glow">404</h1>
            <p className="font-mono text-muted-foreground">[ERROR: PAGE_NOT_FOUND]</p>
          </div>
          
          <p className="text-muted-foreground">
            The requested route does not exist in the system. Return to base or check your access token.
          </p>
          
          <Link to="/">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Terminal className="mr-2 h-4 w-4" />
              Return to Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default NotFound;
