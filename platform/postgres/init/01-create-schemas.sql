DO $$
DECLARE
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY[
    'keycloak',
    'sales',
    'orders',
    'inventory',
    'finance',
    'profile',
    'notifications'
  ]
  LOOP
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', schema_name, current_user);
  END LOOP;
END $$;
