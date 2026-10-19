#!/data/data/com.termux/files/usr/bin/bash

# Navigate to the project folder if it's inside comradeconnect-main
if [ -d "comradeconnect-main" ]; then
    cd comradeconnect-main
elif [ -d "comradeconnect" ]; then
    cd comradeconnect
fi

echo "Initializing git repository..."
git init

echo "Setting remote URL..."
git remote remove origin 2>/dev/null
git remote add origin https://github.com/specialpanda26-sudo/comradeconnect.git

echo "Staging all changes..."
git add .

echo "Committing changes..."
git commit -m "Update project files via Termux" || echo "No new changes to commit."

echo "Pushing to GitHub..."
git branch -M main
git push -u origin main

echo "Done! Changes pushed successfully."
