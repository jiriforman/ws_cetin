import { Card } from '@/components/ui/card';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { Info, Terminal } from 'lucide-react';
import { sanitizeHtml, stripQrAndDriveLinks } from '@/lib/sanitize';

const AboutUs = () => {
  const { sections } = useWorkshop();
  const aboutSection = sections.find((s) => s.pageKey === 'aboutUs');

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center space-x-2 mb-4">
            <Info className="h-8 w-8 text-secondary" />
            <h1 className="narcos-title text-4xl font-bold text-secondary">
              About This Operation
            </h1>
          </div>
        </div>

        <Card className="bg-card border-border p-8 md:p-12">
          <div
            className="prose prose-invert max-w-[75ch] mx-auto [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2"
            dangerouslySetInnerHTML={{
              __html: stripQrAndDriveLinks(sanitizeHtml(aboutSection?.contentRTF || '')),
            }}
            style={{
              color: 'hsl(var(--foreground))',
            }}
          />

          <div className="mt-12 pt-8 border-t border-border">
            <h3 className="font-display text-xl font-bold text-primary mb-4">
              Technical Details
            </h3>
            <div className="space-y-3 text-muted-foreground">
              <div className="flex items-start space-x-2">
                <Terminal className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <p>
                  <strong className="text-foreground">Workshop Format:</strong> Team-based, timed phases 
                  with collaborative AI tool usage and competitive scoring
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <Terminal className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                <p>
                  <strong className="text-foreground">Access Method:</strong> Secure token-based team 
                  access with unique URLs for each team
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-8">
          <Card className="bg-card border-primary/30 p-8 text-center">
            <p className="font-mono text-primary mb-2">Cartel Notice</p>
            <p className="text-muted-foreground">
              Questions during the workshop? Contact your facilitators for immediate support.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
