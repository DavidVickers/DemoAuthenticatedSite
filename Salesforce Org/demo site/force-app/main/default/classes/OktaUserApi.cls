public with sharing class OktaUserApi {

    // Existing example method – kept here for reference
    public static void getOktaUser() {
        // Example: Hard-coded userId for testing
        String oktaUserId = '00upkrfnu0Iy3qqyA697';

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:oktaApi/users/' + oktaUserId);
        req.setMethod('GET');

        Http http = new Http();

        try {
            HttpResponse res = http.send(req);
            System.debug('Status: ' + res.getStatus());
            System.debug('Response Body: ' + res.getBody());
        } catch (Exception e) {
            System.debug('Callout error: ' + e.getMessage());
        }
    }

    /**
     * Utility method to retrieve a user's email from Okta.
     *
     * @param oktaUserId The Okta user ID to retrieve.
     * @return The email address if found, otherwise null.
     */
    public static String getOktaUserEmail(String oktaUserId) {
        if (String.isBlank(oktaUserId)) {
            // Avoid the callout if it's obviously invalid
            return null;
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:oktaApi/users/' + oktaUserId);
        req.setMethod('GET');

        Http http = new Http();
        try {
            HttpResponse res = http.send(req);
            System.debug('Okta response status: ' + res.getStatus());
            System.debug('Okta response body: ' + res.getBody());

            if (res.getStatusCode() == 200) {
                // Parse the JSON string
                // Example Okta JSON:
                // {
                //   "id":"00upkrfnu0Iy3qqyA697",
                //   ...
                //   "profile": {
                //       "firstName":"David",
                //       "lastName":"Vickers",
                //       "login":"David.Vickers@salesforce.com",
                //       "email":"David.Vickers@salesforce.com"
                //   },
                //   ...
                // }

                // We can deserialize into a generic Object map
                Map<String, Object> resultMap = 
                    (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

                if (resultMap.containsKey('profile')) {
                    Map<String, Object> profileMap = 
                        (Map<String, Object>) resultMap.get('profile');
                    if (profileMap != null && profileMap.containsKey('email')) {
                        return (String) profileMap.get('email');
                    }
                }
            } else {
                System.debug('Unexpected status code: ' + res.getStatusCode());
            }
        } catch (Exception e) {
            System.debug('Callout error: ' + e.getMessage());
        }

        // If anything goes wrong or email not found, return null
        return null;
    }
}