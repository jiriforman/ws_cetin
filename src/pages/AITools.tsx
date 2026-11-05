import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { useWorkshop } from '@/contexts/WorkshopContext';
import { ExternalLink, Wrench } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize';
import { groupToolsByCategory, Tool, UNCATEGORISED_LABEL } from '@/lib/workshopData';

const RICH_TEXT_CLASSES =
  'prose prose-invert [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2';
// Key for the uncategorised group in the filter
const OTHER = 'other';

/** One tool as a full-width row; on phones the description shows its first lines until expanded. */
const ToolRow = ({ tool }: { tool: Tool }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="group relative flex items-start gap-4 p-4 hover:bg-primary/5 transition-colors">
      {tool.logoUrl ? (
        <img
          src={tool.logoUrl}
          alt={`${tool.toolName} logo`}
          className="w-10 h-10 md:w-12 md:h-12 object-contain rounded-lg flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0 md:flex md:gap-6">
        <a
          href={tool.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="md:w-64 md:flex-shrink-0 inline-flex items-start gap-1.5 font-display text-lg font-bold text-primary hover:text-glow transition-all"
        >
          {tool.toolName}
          <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0 opacity-60 group-hover:opacity-100" />
        </a>
        <div className="flex-1 min-w-0 mt-1 md:mt-0">
          <p className={`text-muted-foreground text-sm ${expanded ? '' : 'line-clamp-2'} md:line-clamp-none`}>
            {tool.description}
          </p>
          {tool.description && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="md:hidden mt-1 text-xs text-primary"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const AITools = () => {
  const { tools, toolCategories, sections } = useWorkshop();
  const groups = groupToolsByCategory(tools.filter((t) => t.visible), toolCategories).map((g) => ({
    key: g.category?.id ?? OTHER,
    name: g.category?.name ?? UNCATEGORISED_LABEL,
    description: g.category?.description ?? '',
    tools: g.tools,
  }));
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const shownGroups = groups.filter((g) => !activeCategory || g.key === activeCategory);
  // With a single group (e.g. nothing categorised yet) the page looks as before: no filter, no headings
  const grouped = groups.length > 1;
  const aiSection = sections.find((s) => s.pageKey === 'aiTools');

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center space-x-2 mb-4">
            <Wrench className="h-8 w-8 text-primary" />
            <h1 className="narcos-title text-4xl font-bold text-secondary">
              AI Arsenal
            </h1>
          </div>
          <div
            className="text-muted-foreground text-lg max-w-2xl mx-auto prose prose-invert [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-2"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiSection?.contentRTF || '') }}
          />
        </div>

        {grouped && (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {[{ key: null, name: 'All' }, ...groups].map(({ key, name }) => (
              <button
                key={key ?? 'all'}
                type="button"
                onClick={() => setActiveCategory(key)}
                className={`px-4 py-1.5 rounded-full border text-sm font-display transition-colors ${
                  activeCategory === key
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-10">
          {shownGroups.map((group) => (
            <section key={group.key}>
              {grouped && (
                <div className="mb-4">
                  <h2 className="font-display text-2xl font-bold text-secondary flex items-baseline gap-3">
                    {group.name}
                    <span className="text-sm text-muted-foreground font-normal">{group.tools.length}</span>
                  </h2>
                  {group.description && (
                    <div
                      className={`text-muted-foreground text-sm max-w-3xl mt-1 ${RICH_TEXT_CLASSES}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(group.description) }}
                    />
                  )}
                </div>
              )}
              <Card className="bg-card border-border divide-y divide-border overflow-hidden">
                {group.tools.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} />
                ))}
              </Card>
            </section>
          ))}
        </div>

        <div className="mt-12">
          <Card className="bg-card border-border p-8 text-center max-w-2xl mx-auto">
            <h3 className="font-display text-xl font-bold mb-3">
              <span className="text-primary">[TIP]</span> Maximize Your AI Advantage
            </h3>
            <p className="text-muted-foreground">
              Combine multiple AI tools for maximum efficiency. Use Gemini or Claude for analysis,
              Gamma for presentations, Suno for media assets, and NotebookLM for research synthesis.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AITools;
