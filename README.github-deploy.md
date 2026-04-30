# GitHub -> Deno Deploy

This project is ready to be deployed from a GitHub repository instead of local upload.

## 1. Create a GitHub repository

Create a new empty repository in your GitHub account.

Suggested name:

`gpt-image-2-mobile`

Do not add:

- README
- .gitignore
- license

## 2. Push this folder to GitHub

Run these commands in this folder after replacing `YOUR_GITHUB_NAME` with your actual GitHub username:

```powershell
git init
git add .
git commit -m "Initial mobile image app"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_NAME/gpt-image-2-mobile.git
git push -u origin main
```

If Git asks for your identity first:

```powershell
git config user.name "YOUR_NAME"
git config user.email "YOUR_EMAIL"
```

## 3. Connect the repo in Deno Deploy

Open your Deno app in the console and switch the source to GitHub.

Use these settings:

- Source: GitHub
- Runtime mode: Dynamic
- Entrypoint: `deno-deploy-app.mjs`
- Install command: `npm install`
- Build command: `npm run build`
- Working directory: `.`
- Region: `global`

Make sure the environment variable below exists in Deno Deploy:

- `UPSTREAM_API_KEY`

Optional environment variables if you want to override defaults later:

- `UPSTREAM_BASE_URL`
- `UPSTREAM_MODEL`
- `UPSTREAM_GENERATION_ENDPOINT`
- `UPSTREAM_EDIT_ENDPOINT`
- `UPSTREAM_MODELS_ENDPOINT`
- `UPSTREAM_RESPONSE_FORMAT`
- `UPSTREAM_QUALITY`
- `UPSTREAM_BACKGROUND`

## 4. Redeploy

After the repository is connected, trigger a redeploy from the Deno console.
