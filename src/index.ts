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

const FIRESTORE_DATA_PATH = 'data/firestore'
const AUTH_DATA_PATH = 'data/auth'
const STORAGE_DATA_PATH = 'data/storage'
const STORAGE_BUCKET = `${process.env.FIREBASE_PROJECT_ID}.appspot.com`

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
  await makeOrRemoveDirectory(FIRESTORE_DATA_PATH)
  const collections = await firestoreBackups()
  await fs.writeFile(`${FIRESTORE_DATA_PATH}/collections.json`, JSON.stringify(collections, null, '  '))

  // Authentication
  await makeOrRemoveDirectory(AUTH_DATA_PATH)
  await tools.auth.export(`${AUTH_DATA_PATH}/users.json`)

  // Storage
  await makeOrRemoveDirectory(STORAGE_DATA_PATH)
  if ((await execPromise(`gsutil ls gs://${STORAGE_BUCKET}`)).stdout) {
    // > If you experience problems with multiprocessing on MacOS, they might be related to https://bugs.python.org/issue33725.
    // > You can disable multiprocessing by editing your.boto config or by adding the following flag to your command: `-o "GSUtil:parallel_process_count=1"`.
    // > Note that multithreading is still available even if you disable multiprocessing.
    await execPromise(`gsutil -m -o "GSUtil:parallel_process_count=1" cp -r gs://${STORAGE_BUCKET}/* ${STORAGE_DATA_PATH}`)
  }
}

const restore = async () => {
  // Firestore
  if (await directoryExists(FIRESTORE_DATA_PATH)) {
    await firestoreRestore(`${FIRESTORE_DATA_PATH}/collections.json`)
  }

  // Authentication
  if (await directoryExists(AUTH_DATA_PATH)) {
    await tools.auth.upload(`${AUTH_DATA_PATH}/users.json`, {
      hashAlgo: 'HMAC_SHA256',
      hashKey: 'N2RheXM=',
    })
  }

  // Storage
  if (await directoryExists(STORAGE_DATA_PATH)) {
    // > If you experience problems with multiprocessing on MacOS, they might be related to https://bugs.python.org/issue33725.
    // > You can disable multiprocessing by editing your.boto config or by adding the following flag to your command: `-o "GSUtil:parallel_process_count=1"`.
    // > Note that multithreading is still available even if you disable multiprocessing.
    await execPromise(`gsutil -m -o "GSUtil:parallel_process_count=1" cp -r ${STORAGE_DATA_PATH}/* gs://${STORAGE_BUCKET}`)
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
  .version('0.0.4')
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