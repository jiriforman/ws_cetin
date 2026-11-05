import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminApi } from '@/lib/api';
import { explainApiError, type Overview } from '@/lib/negotiation';
import NegotiationResults from './NegotiationResults';
import NegotiationSettings from './NegotiationSettings';
import SupplierEditor from './SupplierEditor';
import BackendStatus from './BackendStatus';

/** Admin "Negotiation" tab: results, AI settings + cost, supplier prompts and materials. */
const NegotiationAdmin = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setOverview(await adminApi<Overview>('negotiation-overview'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 10_000);
    return () => clearInterval(t);
  }, [reload]);

  if (!overview) {
    return (
      <Card className="bg-card border-border p-6 text-sm text-muted-foreground">
        {error ? `Could not load the negotiation room: ${explainApiError(error)}. Has the database migration been applied?` : 'Loading…'}
      </Card>
    );
  }

  return (
    <>
    <BackendStatus adminVersion={overview.api_version} />
    <Tabs defaultValue="results" className="space-y-4">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="results">Results & cost</TabsTrigger>
        <TabsTrigger value="suppliers">Suppliers & prompts</TabsTrigger>
        <TabsTrigger value="settings">AI model & rules</TabsTrigger>
      </TabsList>
      <TabsContent value="results">
        <NegotiationResults overview={overview} reload={reload} />
      </TabsContent>
      <TabsContent value="suppliers">
        <SupplierEditor overview={overview} reload={reload} />
      </TabsContent>
      <TabsContent value="settings">
        <NegotiationSettings overview={overview} reload={reload} />
      </TabsContent>
    </Tabs>
    </>
  );
};

export default NegotiationAdmin;
