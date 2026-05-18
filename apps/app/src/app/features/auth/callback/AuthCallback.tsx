import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMeThunk, useAppDispatch } from '@org/store';
import { PageLoader } from '@org/ui';
import { toast } from 'sonner';
import { consumeRedirectTarget } from '../redirect-target';

export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const status = params.get('status');
    const method = params.get('method');

    if (status === 'authenticated') {
      void dispatch(fetchMeThunk()).then(() => {
        toast.success(`Signed in with ${method ?? 'OAuth'}`);
        const next = consumeRedirectTarget() ?? '/dashboard';
        navigate(next, { replace: true });
      });
    } else {
      toast.error('Authentication failed');
      navigate('/login', { replace: true });
    }
  }, [params, navigate, dispatch]);

  return <PageLoader message="Completing sign in..." />;
}

export default AuthCallback;
