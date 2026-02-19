#!/bin/sh
set -eu

KCADM=/opt/keycloak/bin/kcadm.sh
REALM=scranton-branch
SERVER=http://keycloak:8080
ADMIN_USER=${KEYCLOAK_ADMIN:-admin}
ADMIN_PASS=${KEYCLOAK_ADMIN_PASSWORD:-admin}

$KCADM config credentials --server "$SERVER" --realm master --user "$ADMIN_USER" --password "$ADMIN_PASS"

for provider_name in dunder-ldap temp-ldap; do
  for id in $($KCADM get components -r "$REALM" -q name="$provider_name" | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p'); do
    $KCADM delete "components/$id" -r "$REALM"
  done
done

$KCADM create components -r "$REALM" \
  -s name=dunder-ldap \
  -s providerId=ldap \
  -s providerType=org.keycloak.storage.UserStorageProvider \
  -s parentId="$REALM" \
  -s 'config.enabled=["true"]' \
  -s 'config.priority=["0"]' \
  -s 'config.importEnabled=["true"]' \
  -s 'config.syncRegistrations=["false"]' \
  -s 'config.vendor=["other"]' \
  -s 'config.usernameLDAPAttribute=["uid"]' \
  -s 'config.rdnLDAPAttribute=["uid"]' \
  -s 'config.uuidLDAPAttribute=["entryUUID"]' \
  -s 'config.userObjectClasses=["inetOrgPerson, organizationalPerson, person, top"]' \
  -s 'config.connectionUrl=["ldap://openldap:389"]' \
  -s 'config.usersDn=["ou=people,dc=dundermifflin,dc=com"]' \
  -s 'config.authType=["simple"]' \
  -s 'config.bindDn=["cn=admin,dc=dundermifflin,dc=com"]' \
  -s 'config.bindCredential=["admin"]' \
  -s 'config.searchScope=["2"]' \
  -s 'config.editMode=["READ_ONLY"]' \
  -s 'config.trustEmail=["true"]' \
  -s 'config.pagination=["true"]' \
  -s 'config.batchSizeForSync=["1000"]' \
  -s 'config.fullSyncPeriod=["-1"]' \
  -s 'config.changedSyncPeriod=["-1"]' \
  -s 'config.cachePolicy=["DEFAULT"]'

LDAP_ID=$($KCADM get components -r "$REALM" -q name=dunder-ldap | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p' | tail -n1)
test -n "$LDAP_ID"

ensure_user() {
  username=$1
  first_name=$2
  last_name=$3
  email=$4
  role=$5

  if ! $KCADM get users -r "$REALM" -q username="$username" | grep -q "\"username\" : \"$username\""; then
    $KCADM create users -r "$REALM" -s "username=$username" -s enabled=true -s "firstName=$first_name" -s "lastName=$last_name" -s "email=$email"
  fi

  $KCADM set-password -r "$REALM" --username "$username" --new-password password
  $KCADM add-roles -r "$REALM" --uusername "$username" --rolename "$role" || true
}

ensure_user jhalpert Jim Halpert jhalpert@dundermifflin.com sales-associate
ensure_user dphilbin Darryl Philbin dphilbin@dundermifflin.com warehouse-operator
ensure_user amartin Angela Martin amartin@dundermifflin.com accountant
