// Shared bits for appraisals (components/reviews/ReviewForm, pages Reviews and MyReviews).
export const RECOMMENDATIONS = ['None', 'Increase', 'Promotion', 'Bonus', 'Training', 'Improvement Plan'];
export const recKey = (r) => String(r || '').toLowerCase().replace(/\s+/g, '_');
export const reviewStatusKey = (s) => String(s || '').toLowerCase().replace(/\s+/g, '_');
export const reviewStatusVariant = (s) => ({ 'Self Review': 'info', 'Manager Review': 'warning', 'HR Review': 'brand', Completed: 'success' }[s] || 'info');
