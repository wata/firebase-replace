# firebase-replace

NPM package for backup, restore, delete and replace Firebase

## Installation

Install the firebase-replace CLI as a global CLI.

```
npm install -g firebase-replace
```

## Get Firebase Service Account File

1. Visit the Firebase Console
1. Select your project
1. Navigate to Project Settings (at the time of writing the gear icon button at the top left of the page).
1. Navigate to Service Accounts
1. Click Generate New Private Key

## Set environment variables

```sh
# Your Firebase Project ID
export FIREBASE_PROJECT_ID=XXXX-XXXXX

# Your Firebase Service Account File Path
export GOOGLE_APPLICATION_CREDENTIALS=./XXXX-XXXXX-firebase-adminsdk-XXXXX-XXXXXXXXXX.json
```

## Usage

```sh
# Backup Firestore, Authentication, Storage
firebase-replace backup
tree ./data
# data
# ├── auth
# │   └── users.json
# ├── firestore
# │   └── collections.json
# └── storage

# Restore Firestore, Authentication, Storage
firebase-replace restore

# Delete Firestore, Authentication, Storage
firebase-replace delete

# Delete and restore
firebase-replace replace
```
