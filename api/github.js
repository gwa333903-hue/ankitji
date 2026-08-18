// File: api/github.js
export default async function handler(req, res) {
  // We put your variables here on the server where they are safe!
  const GITHUB_USERNAME = "gwa333903-hue"; 
  const GITHUB_REPO = "class"; 
  
  // This is where process.env goes! It works here.
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
  
  try {
    // This fetches data about your specific repository
    const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Serverless-Function'
      }
    });

    const data = await response.json();
    
    // Send the data back to your app.js
    res.status(200).json(data);
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}