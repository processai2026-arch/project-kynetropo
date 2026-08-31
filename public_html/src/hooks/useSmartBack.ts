import { useNavigate } from 'react-router-dom';

/**
 * Returns a back() function that uses browser history when available,
 * otherwise navigates to the given fallback route.
 */
export function useSmartBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };
}

export default useSmartBack;
