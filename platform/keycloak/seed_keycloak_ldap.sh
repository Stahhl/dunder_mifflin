#!/bin/sh
set -eu

KCADM=/opt/keycloak/bin/kcadm.sh
REALM=scranton-branch
SERVER=http://keycloak:8080
ADMIN_USER=${KEYCLOAK_ADMIN:-admin}
ADMIN_PASS=${KEYCLOAK_ADMIN_PASSWORD:-admin}

$KCADM config credentials --server "$SERVER" --realm master --user "$ADMIN_USER" --password "$ADMIN_PASS"

GATEWAY_CLIENT_ID=$($KCADM get clients -r "$REALM" -q clientId=dunder-mifflin-gateway | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p' | head -n1)
if [ -n "$GATEWAY_CLIENT_ID" ]; then
  $KCADM update "clients/$GATEWAY_CLIENT_ID" -r "$REALM" \
    -s 'redirectUris=["http://localhost:8081/*","http://host.docker.internal:8081/*","http://localhost:5173/*"]' \
    -s 'webOrigins=["http://localhost:8081","http://host.docker.internal:8081","http://localhost:5173"]'
fi

WAREHOUSE_CLIENT_ID=$($KCADM get clients -r "$REALM" -q clientId=warehouse-mobile | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p' | head -n1)
if [ -n "$WAREHOUSE_CLIENT_ID" ]; then
  $KCADM update "clients/$WAREHOUSE_CLIENT_ID" -r "$REALM" \
    -s 'redirectUris=["exp://*","dundermifflin://*","http://localhost:3004/*","http://host.docker.internal:3004/*"]' \
    -s 'webOrigins=["http://localhost:3004","http://host.docker.internal:3004"]' \
    -s 'attributes."pkce.code.challenge.method"=S256'
fi

OBSERVABILITY_CLIENT_ID=$($KCADM get clients -r "$REALM" -q clientId=dunder-observability | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p' | head -n1)
if [ -n "$OBSERVABILITY_CLIENT_ID" ]; then
  $KCADM update "clients/$OBSERVABILITY_CLIENT_ID" -r "$REALM" \
    -s 'publicClient=false' \
    -s 'secret=observability-secret-change-me' \
    -s 'standardFlowEnabled=true' \
    -s 'directAccessGrantsEnabled=false' \
    -s 'serviceAccountsEnabled=false' \
    -s 'redirectUris=["http://localhost:3005/login/generic_oauth","http://host.docker.internal:3005/login/generic_oauth"]' \
    -s 'webOrigins=["http://localhost:3005","http://host.docker.internal:3005"]'
else
  $KCADM create clients -r "$REALM" \
    -s clientId=dunder-observability \
    -s name='Dunder Mifflin Observability' \
    -s enabled=true \
    -s protocol=openid-connect \
    -s publicClient=false \
    -s secret=observability-secret-change-me \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=false \
    -s serviceAccountsEnabled=false \
    -s 'redirectUris=["http://localhost:3005/login/generic_oauth","http://host.docker.internal:3005/login/generic_oauth"]' \
    -s 'webOrigins=["http://localhost:3005","http://host.docker.internal:3005"]'
fi

if [ -z "$OBSERVABILITY_CLIENT_ID" ]; then
  OBSERVABILITY_CLIENT_ID=$($KCADM get clients -r "$REALM" -q clientId=dunder-observability | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p' | head -n1)
fi
test -n "$OBSERVABILITY_CLIENT_ID"

for mapper_id in $($KCADM get "clients/$OBSERVABILITY_CLIENT_ID/protocol-mappers/models" -r "$REALM" | sed -n 's/.*"id" : "\([^"]*\)".*/\1/p'); do
  $KCADM delete "clients/$OBSERVABILITY_CLIENT_ID/protocol-mappers/models/$mapper_id" -r "$REALM"
done

$KCADM create "clients/$OBSERVABILITY_CLIENT_ID/protocol-mappers/models" -r "$REALM" \
  -s name=realm-roles \
  -s protocol=openid-connect \
  -s protocolMapper=oidc-usermodel-realm-role-mapper \
  -s 'config."multivalued"="true"' \
  -s 'config."userinfo.token.claim"="true"' \
  -s 'config."id.token.claim"="true"' \
  -s 'config."access.token.claim"="true"' \
  -s 'config."claim.name"="roles"' \
  -s 'config."jsonType.label"="String"'

$KCADM create "clients/$OBSERVABILITY_CLIENT_ID/protocol-mappers/models" -r "$REALM" \
  -s name=groups \
  -s protocol=openid-connect \
  -s protocolMapper=oidc-group-membership-mapper \
  -s 'config."full.path"="true"' \
  -s 'config."userinfo.token.claim"="true"' \
  -s 'config."id.token.claim"="true"' \
  -s 'config."access.token.claim"="true"' \
  -s 'config."claim.name"="groups"' \
  -s 'config."jsonType.label"="String"'

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

ensure_role() {
  role_name=$1
  if ! $KCADM get "roles/$role_name" -r "$REALM" >/dev/null 2>&1; then
    $KCADM create roles -r "$REALM" -s "name=$role_name"
  fi
}

ensure_role sales-associate
ensure_role warehouse-operator
ensure_role accountant
ensure_role manager
ensure_role portal-user
ensure_role it-support

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
ensure_user nick Nick IT nick@dundermifflin.com it-support
