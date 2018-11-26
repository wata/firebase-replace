# firebase-manage

```sh
firebase-manage.sh is a Firebase management tool.

Usage:
    firebase-manage.sh [command] [<options>]

Options:
    --version, -v     Print firebase-manage.sh version.
    --help, -h        Print this.

Commands:
    backup            Backup Firestore, Authentication, Storage.
    restore           Restore Firestore, Authentication, Storage with deploying project.
    delete            Delete Firestore, Storage.
    replace           Delete and restore.
```

## Dependencies
- [firestore-backup-restore](https://github.com/willhlaw/node-firestore-backup-restore)
- [firebase-tools](https://github.com/firebase/firebase-tools)
- [gsutil](https://cloud.google.com/storage/docs/gsutil_install)

## Retrieving Firebase Service Account File
1. Visit the Firebase Console
1. Select your project
1. Navigate to Project Settings (at the time of writing the gear icon button at the top left of the page).
1. Navigate to Service Accounts
1. Click Generate New Private Key

This downloaded json file contains the proper credentials needed for `firestore-backup-restore` to authenticate.

## Tips

- Fix firestore timestamp warnings

    ```sh
    npm install -g kitfit-dave/node-firestore-backup-restore
    ```

- Use environment variables for `PROJECT_ID` and `SERVICE_ACCOUNT_FILE`

    => [DotenvではなくDirenvを使う](https://deeeet.com/writing/2014/05/06/direnv/) (ja)

- Ignore `.DS_Store`

    ```sh
    find ./ -name ".DS_Store" -print -exec rm {} ";"
    killall Finder
    ```
