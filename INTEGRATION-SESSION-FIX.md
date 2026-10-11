# Integration dashboard session correction

The restaurant uses rc-ordera-restaurant-auth; the dashboard previously used the SDK default storage namespace. Align the dashboard to the existing restaurant key. Disable URL session detection on this read-only screen; token refresh remains disabled. No SQL, credentials, RLS, operational controls or production branch changes.

Regression: tests/integration-session.test.cjs checks namespace alignment, distribution synchronization and syntax. The reviewed byte delta ledger includes this exact edit, retaining its reverse reconstruction check against the original GitHub source. CI results must be checked on the latest commit. Browser login and Edge integration-status deployment still require verification. The previously delivered ZIP does not include this correction.
