#!/usr/bin/env node

import { Command } from 'commander'
const program = new Command()
import * as util from 'util'
import { exec } from 'child_process'
const execPromise = util.promisify(exec)
import { promises as fs } from 'fs'
import * as tools from 'firebase-tools'
import * as admin from 'firebase-admin'
admin.initializeApp({ credential: admin.credential.applicationDefault() })
import { backups as firestoreBackups, restore as firestoreRestore } from 'firestore-export-import'

const FIRESTORE_DATA_DIR = 'data/firestore'
const FIRESTORE_DATA_PATH = `${FIRESTORE_DATA_DIR}/collections.json`
const AUTH_DATA_DIR = 'data/auth'
const AUTH_DATA_PATH = `${AUTH_DATA_DIR}/users.json`
const STORAGE_DATA_DIR = 'data/storage'
const STORAGE_BUCKET = `${process.env.FIREBASE_PROJECT_ID}.appspot.com`

const fileExists = async (path: string) => {
    return await fs.access(path)
        .then(() => true)
        .catch(() => false)
}

const anyFileExists = async (path: string) => {
  const files = await fs.readdir(path)
  return files.length > 0
}

const directoryExists = async (path: string) => {
  return await fs.stat(path)
    .then((stats) => stats.isDirectory())
    .catch(() => false)
}

const makeOrRemoveDirectory = async (path: string) => {
  if (await directoryExists(path)) {
    await execPromise(`rm -rf ${path}/*`)
  } else {
    await fs.mkdir(path, { recursive: true })
  }
}

const backup = async () => {
  // Firestore
  await makeOrRemoveDirectory(FIRESTORE_DATA_DIR)
  const collections = await firestoreBackups()
  await fs.writeFile(FIRESTORE_DATA_PATH, JSON.stringify(collections, null, '  '))

  // Authentication
  await makeOrRemoveDirectory(AUTH_DATA_DIR)
  await tools.auth.export(AUTH_DATA_PATH)

  // Storage
  await makeOrRemoveDirectory(STORAGE_DATA_DIR)
  if ((await execPromise(`gsutil ls gs://${STORAGE_BUCKET}`)).stdout) {
    // > If you experience problems with multiprocessing on MacOS, they might be related to https://bugs.python.org/issue33725.
    // > You can disable multiprocessing by editing your.boto config or by adding the following flag to your command: `-o "GSUtil:parallel_process_count=1"`.
    // > Note that multithreading is still available even if you disable multiprocessing.
    await execPromise(`gsutil -m -o "GSUtil:parallel_process_count=1" cp -r gs://${STORAGE_BUCKET}/* ${STORAGE_DATA_DIR}`)
  }
}

const restore = async () => {
  // Firestore
  if (await fileExists(FIRESTORE_DATA_PATH)) {
    await firestoreRestore(FIRESTORE_DATA_PATH, {
      autoParseDates: true,
      autoParseGeos: true,
    })
  }

  // Authentication
  if (await fileExists(AUTH_DATA_PATH)) {
    await tools.auth.upload(AUTH_DATA_PATH, {
      hashAlgo: 'HMAC_SHA256',
      hashKey: 'N2RheXM=',
    })
  }

  // Storage
  if (await anyFileExists(STORAGE_DATA_DIR)) {
    // > If you experience problems with multiprocessing on MacOS, they might be related to https://bugs.python.org/issue33725.
    // > You can disable multiprocessing by editing your.boto config or by adding the following flag to your command: `-o "GSUtil:parallel_process_count=1"`.
    // > Note that multithreading is still available even if you disable multiprocessing.
    await execPromise(`gsutil -m -o "GSUtil:parallel_process_count=1" cp -r ${STORAGE_DATA_DIR}/* gs://${STORAGE_BUCKET}`)
  }
}

const _delete = async () => {
  // Firestore
  await tools.firestore.delete({ allCollections: true })

  // Authentication
  const authInstance = admin.auth()
  const usersResult = await authInstance.listUsers()
  const uids = usersResult.users.map((user) => user.uid)
  await authInstance.deleteUsers(uids)

  // Storage
  if ((await execPromise(`gsutil ls gs://${STORAGE_BUCKET}`)).stdout) {
    await execPromise(`gsutil rm gs://${STORAGE_BUCKET}/**`)
  }
}

const checkEnv = () => {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error('Missing env FIREBASE_PROJECT_ID')
    process.exit(1)
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing env GOOGLE_APPLICATION_CREDENTIALS')
    process.exit(1)
  }
}

program
  .version('0.0.8')
  .description('NPM package for backup, restore, delete and replace Firebase')

program
  .command('backup')
  .description('backup Firestore, Authentication, Storage')
  .action(async () => {
    checkEnv()
    await backup()
  })

program
  .command('restore')
  .description('restore Firestore, Authentication, Storage')
  .action(async () => {
    checkEnv()
    await restore()
  })

program
  .command('delete')
  .description('delete Firestore, Authentication, Storage')
  .action(async () => {
    checkEnv()
    await _delete()
  })

program
  .command('replace')
  .description('delete and restore')
  .action(async () => {
    checkEnv()
    await _delete()
    await restore()
  })

program.parse()