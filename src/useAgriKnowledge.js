import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './lib/api';

export default function useAgriKnowledge(imageType) {
  const [catalog, setCatalog] = useState(null);
  const [illustrations, setIllustrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadIndex, setReloadIndex] = useState(0);
  const requestedImages = useRef(new Set());
  const inFlightImages = useRef(new Set());
  const retry = useCallback(() => setReloadIndex((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setIllustrations({});
    requestedImages.current.clear();
    inFlightImages.current.clear();

    api.getAgriKnowledge()
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load the agricultural knowledge catalog.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [imageType, reloadIndex]);

  const loadIllustration = useCallback(async (id) => {
    if (!id || requestedImages.current.has(id) || inFlightImages.current.has(id)) return;
    inFlightImages.current.add(id);
    setIllustrations((current) => ({
      ...current,
      [id]: { id, available: false, loading: true, image: null, error: '' },
    }));
    try {
      const result = await api.getAgriKnowledgeImages(imageType, id);
      const illustration = result.illustrations[0];
      requestedImages.current.add(id);
      setIllustrations((current) => ({ ...current, [id]: illustration }));
    } catch (requestError) {
      requestedImages.current.add(id);
      setIllustrations((current) => ({
        ...current,
        [id]: {
          id,
          available: false,
          loading: false,
          image: null,
          error: requestError.message || 'Image search is unavailable.',
        },
      }));
    } finally {
      inFlightImages.current.delete(id);
    }
  }, [imageType]);

  return { catalog, illustrations, loading, error, retry, loadIllustration };
}
