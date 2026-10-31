/**
 * SkillSync - Job Scraper & Cache Client Module
 * File: assets/js/modules/scraper.js
 */

export async function scrapeJobPosting(url, authToken) {
  if (!url || typeof url !== 'string') {
    throw new Error('A valid job URL must be provided.');
  }

  const response = await fetch('scrape.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken || 'demo-token'}`
    },
    body: JSON.stringify({ url: url.trim() })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to scrape job description.');
  }

  return data;
}
