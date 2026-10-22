export const parseWorldCupSearch = (search = '') =>
  Object.fromEntries(new URLSearchParams(search).entries());
