import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysis, useAsk, useRunAnalysis, type InsightScope } from './queries';

const RISK_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

/**
 * Phase 2 insights (docs/05 §7): on-demand analysis (summary / parties /
 * obligations / key dates / risk flags + cited-law health) and a RAG
 * "ask this document" box with page-cited answers.
 */
export function DocumentInsights({
  sourceId,
  scope = 'source',
}: {
  /** Subject id — a SourceDocument id (scope 'source') or Document id ('document'). */
  sourceId: string;
  scope?: InsightScope;
}) {
  const { t } = useTranslation();
  const analysisQuery = useAnalysis(sourceId, scope);
  const runAnalysis = useRunAnalysis(sourceId, scope);
  const ask = useAsk(sourceId, scope);
  const [question, setQuestion] = useState('');

  const analysis = analysisQuery.data?.analysis;

  return (
    <div className="space-y-6">
      {/* Analysis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{t('intelligence.insights.title', 'Analysis')}</CardTitle>
            <CardDescription>
              {t(
                'intelligence.insights.subtitle',
                'Summary, parties, obligations, key dates, and cited-law health.',
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => runAnalysis.mutate({})}
            disabled={runAnalysis.isPending}
          >
            {runAnalysis.isPending
              ? t('intelligence.insights.analyzing', 'Analyzing…')
              : analysis
                ? t('intelligence.insights.rerun', 'Re-analyze')
                : t('intelligence.insights.run', 'Analyze document')}
          </Button>
        </CardHeader>

        {(analysisQuery.isLoading || runAnalysis.isPending) && (
          <CardContent className="flex justify-center py-6">
            <Spinner />
          </CardContent>
        )}

        {analysis && !runAnalysis.isPending && (
          <CardContent className="space-y-4 text-sm">
            {analysis.summary && (
              <p className="text-foreground/80">{analysis.summary}</p>
            )}

            {!!analysis.parties?.length && (
              <Section label={t('intelligence.insights.parties', 'Parties')}>
                {analysis.parties.map((p, i) => (
                  <li key={i}>
                    <strong>{p.name}</strong>
                    {p.role ? ` — ${p.role}` : ''}
                  </li>
                ))}
              </Section>
            )}

            {!!analysis.keyDates?.length && (
              <Section label={t('intelligence.insights.dates', 'Key dates')}>
                {analysis.keyDates.map((d, i) => (
                  <li key={i}>
                    {d.label}
                    {d.date ? `: ${d.date}` : ''}
                  </li>
                ))}
              </Section>
            )}

            {!!analysis.obligations?.length && (
              <Section
                label={t('intelligence.insights.obligations', 'Obligations')}
              >
                {analysis.obligations.map((o, i) => (
                  <li key={i}>
                    {o.party ? <strong>{o.party}: </strong> : null}
                    {o.obligation}
                  </li>
                ))}
              </Section>
            )}

            {!!analysis.riskFlags?.length && (
              <div className="space-y-1">
                <p className="font-medium">
                  {t('intelligence.insights.risks', 'Risk flags')}
                </p>
                <div className="space-y-1">
                  {analysis.riskFlags.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant={RISK_VARIANT[r.severity] ?? 'secondary'}>
                        {r.severity}
                      </Badge>
                      <span className="text-foreground/80">{r.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cited-law health — deterministic, from @org/legal-reference */}
            <div className="space-y-1">
              <p className="font-medium">
                {t('intelligence.insights.citedLaw', 'Cited-law health')}
              </p>
              {analysis.citationFindings?.length ? (
                <ul className="list-inside list-disc text-foreground/80">
                  {analysis.citationFindings.map((c, i) => (
                    <li key={i}>
                      <Badge variant="warning" className="mr-1">
                        {c.code}
                        {c.section ? ` §${c.section}` : ''}
                      </Badge>
                      {c.message}
                      {c.suggestion ? ` → ${c.suggestion}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-foreground/60">
                  {t(
                    'intelligence.insights.noCitationIssues',
                    'No repealed-law references detected.',
                  )}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Ask this document */}
      <Card>
        <CardHeader>
          <CardTitle>{t('intelligence.ask.title', 'Ask this document')}</CardTitle>
          <CardDescription>
            {t(
              'intelligence.ask.subtitle',
              'Answers are grounded in the document and cite the page they came from.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) ask.mutate(question.trim());
            }}
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t(
                'intelligence.ask.placeholder',
                'e.g. What is the notice period?',
              )}
            />
            <Button type="submit" disabled={ask.isPending || !question.trim()}>
              {ask.isPending
                ? t('intelligence.ask.asking', 'Asking…')
                : t('intelligence.ask.ask', 'Ask')}
            </Button>
          </form>

          {ask.data && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3 text-sm">
              <p className="whitespace-pre-wrap text-foreground/90">
                {ask.data.answer}
              </p>
              {!!ask.data.citations.length && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {ask.data.citations.map((c, i) => (
                    <Badge key={i} variant="info" outline>
                      {t('intelligence.review.page', 'p.{{n}}', { n: c.page })}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{label}</p>
      <ul className="list-inside list-disc text-foreground/80">{children}</ul>
    </div>
  );
}
