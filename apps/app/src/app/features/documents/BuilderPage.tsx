import { useParams } from 'react-router-dom';
import { BuilderShell } from './builder/BuilderShell';

/**
 * Route entry for /documents/:id/edit. Pulls the id from the URL and
 * hands it to the BuilderShell, which owns all builder state.
 */
export function BuilderPage() {
  const { id = '' } = useParams();
  if (!id) {
    return <p className="text-error">Missing document id in URL.</p>;
  }
  return <BuilderShell documentId={id} />;
}
