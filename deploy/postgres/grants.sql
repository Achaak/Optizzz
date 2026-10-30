-- The site's rights (docs/adr/0008-comptes-schema-accounts.md): it reads the servers' data in « public » and writes only
-- the accounts. Run by deploy.sh after the migrations, as the owner « optizzz »; running it again changes nothing.
GRANT USAGE ON SCHEMA public TO optizzz_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO optizzz_app;
ALTER DEFAULT PRIVILEGES FOR ROLE optizzz IN SCHEMA public GRANT SELECT ON TABLES TO optizzz_app;

GRANT USAGE ON SCHEMA accounts TO optizzz_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA accounts TO optizzz_app;
ALTER DEFAULT PRIVILEGES FOR ROLE optizzz IN SCHEMA accounts GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO optizzz_app;
