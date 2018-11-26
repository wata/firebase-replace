#!/usr/bin/env bash
set -eu

ROOT_PATH=$(cd $(dirname $0)/; pwd)
FIRESTORE_PATH=${ROOT_PATH}/data/firestore
STORAGE_PATH=${ROOT_PATH}/data/storage
AUTH_PATH=${ROOT_PATH}/data/auth

function _setup {
    # Check dependencies.
    commands=("firestore-backup-restore" "firebase" "gsutil")
    for i in "${commands[@]}"
    do
        if ! hash "${i}" 2>/dev/null; then
            echo -e "\n\033[41mCommand '${i}' not found\033[0m\n"
            exit 1
        fi
    done

    # Set firebase info.
    if [ -z "${PROJECT_ID:-}" ]; then
        printf "Project ID: "
        read PROJECT_ID
    fi
    if [ -z "${SERVICE_ACCOUNT_FILE:-}" ]; then
        printf "Service Account File: "
        read SERVICE_ACCOUNT_FILE
    fi
    BUCKET="${PROJECT_ID}.appspot.com"

    # Validate firebase project ID.
    case ${PROJECT_ID} in
        [a-z0-9-]*)
            # ok
        ;;
        *)
            echo -e "\n\033[41mInvalid Project ID '${PROJECT_ID}'\033[0m\n"
            exit 1
        ;;
    esac

    # Check exists firebase project.
    firebase list | grep ${PROJECT_ID} &> /dev/null &&:
    if [[ $? -eq 1 ]]; then
        echo -e "\n\033[41mFirebase project '${PROJECT_ID}' not found\033[0m\n"
        exit 1
    fi
}

###############################################################################
# Commands
###############################################################################

function backup {
    # First, remove directories.
    rm -rf ${ROOT_PATH}/data/firestore/*
    rm -rf ${ROOT_PATH}/data/storage/*
    rm -rf ${ROOT_PATH}/data/auth/*

    # Firestore
    echo -e '\n\033[32m-------------------------\033[0m'
    echo -e '\033[32m--- Backup: Firestore ---\033[0m'
    echo -e '\033[32m-------------------------\033[0m\n'
    firestore-backup-restore --accountCredentials ${SERVICE_ACCOUNT_FILE} --backupPath ${FIRESTORE_PATH} --prettyPrint --stable

    # Storage
    echo -e '\n\033[32m-----------------------\033[0m'
    echo -e '\033[32m--- Backup: Storage ---\033[0m'
    echo -e '\033[32m-----------------------\033[0m\n'
    gsutil -m cp -r gs://${BUCKET}/* ${STORAGE_PATH}

    # Authentication
    echo -e '\n\033[32m------------------------------\033[0m'
    echo -e '\033[32m--- Backup: Authentication ---\033[0m'
    echo -e '\033[32m------------------------------\033[0m\n'
    firebase -P ${PROJECT_ID} auth:export ${AUTH_PATH}/users.json
}

function restore {
    # First, deploy firebase project.
    firebase -P ${PROJECT_ID} deploy

    # Firestore
    echo -e '\n\033[32m--------------------------\033[0m'
    echo -e '\033[32m--- Restore: Firestore ---\033[0m'
    echo -e '\033[32m--------------------------\033[0m\n'
    firestore-backup-restore --backupPath ${FIRESTORE_PATH} --restoreAccountCredentials ${SERVICE_ACCOUNT_FILE}

    # Storage
    echo -e '\n\033[32m------------------------\033[0m'
    echo -e '\033[32m--- Restore: Storage ---\033[0m'
    echo -e '\033[32m------------------------\033[0m\n'
    gsutil -m cp -r ${STORAGE_PATH}/* gs://${BUCKET}

    # Authentication
    echo -e '\n\033[32m-------------------------------\033[0m'
    echo -e '\033[32m--- Restore: Authentication ---\033[0m'
    echo -e '\033[32m-------------------------------\033[0m\n'
    firebase -P ${PROJECT_ID} auth:import ${AUTH_PATH}/users.json --hash-algo=HMAC_SHA256 --hash-key=N2RheXM=
}

function delete {
    # Firestore
    echo -e '\n\033[32m-------------------------\033[0m'
    echo -e '\033[32m--- Delete: Firestore ---\033[0m'
    echo -e '\033[32m-------------------------\033[0m\n'
    firebase -P ${PROJECT_ID} firestore:delete --all-collections

    # Storage
    echo -e '\n\033[32m-----------------------\033[0m'
    echo -e '\033[32m--- Delete: Storage ---\033[0m'
    echo -e '\033[32m-----------------------\033[0m\n'
    gsutil rm gs://$BUCKET/**
}

function usage {
    cat <<EOF
$(basename ${0}) is a Firebase management tool.

Usage:
    $(basename ${0}) [command] [<options>]

Options:
    --version, -v     Print $(basename ${0}) version.
    --help, -h        Print this.

Commands:
    backup            Backup Firestore, Authentication, Storage.
    restore           Restore Firestore, Authentication, Storage with deploying project.
    delete            Delete Firestore, Storage.
    replace           Delete and restore.

EOF
}

function version {
    echo "$(basename ${0}) version 0.0.1 "
}

###############################################################################
# Main
###############################################################################

function main {
    if [ $# -ne 1 ]; then
        usage
        exit 1
    fi

    case ${1} in
        backup)
            _setup
            trap "echo -e '\n\033[32mSUCCEEDED\033[0m\n'" 0
            backup
        ;;
        restore)
            _setup
            trap "echo -e '\n\033[32mSUCCEEDED\033[0m\n'" 0
            restore
        ;;
        delete)
            _setup
            trap "echo -e '\n\033[32mSUCCEEDED\033[0m\n'" 0
            delete
        ;;
        replace)
            _setup
            trap "echo -e '\n\033[32mSUCCEEDED\033[0m\n'" 0
            delete
            restore
        ;;
        help|--help|-h)
            usage
        ;;
        version|--version|-v)
            version
        ;;
        *)
            echo "\n\033[41mInvalid subcommand '${1}'\033[0m\n"
            usage
            exit 1
        ;;
    esac
}

main "$@"
