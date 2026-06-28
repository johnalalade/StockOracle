const json = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

export const api = {
  health: () => fetch('/api/health').then(json),
  stocks: (q = '') => fetch(`/api/stocks?q=${encodeURIComponent(q)}`).then(json),
  predict: (ticker) =>
    fetch('/api/predict', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticker }),
    }).then(json),
};
