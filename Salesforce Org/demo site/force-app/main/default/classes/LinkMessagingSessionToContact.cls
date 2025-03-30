global with sharing class LinkMessagingSessionToContact {
    @InvocableMethod(label='Link Session to Contact' callout=true description='Given a Messaging Session Key, fetch & link the Contact/Account if missing.')
    global static List<InvokeResult> linkSession(List<SessionRequest> requests) {
        List<InvokeResult> results = new List<InvokeResult>();
		System.debug('LINE 5 ' + requests);
       
            InvokeResult singleResult = new InvokeResult();
            singleResult.sessionKey = requests[0].sessionKey;
			string sessKey = requests[0].sessionKey;
        System.debug('LINE 10 ' + sessKey);
            try {
                // 1) Query the MessagingSession & related MessagingEndUser in one go
                List<MessagingSession> sessions = [
                    SELECT Id, SessionKey,
                    MessagingEndUserId,
                    MessagingEndUser.AccountId,
                    MessagingEndUser.ContactId,
                    MessagingEndUser.MessagingPlatformKey
                    FROM MessagingSession
                    WHERE (SessionKey = :sessKey OR Id = :sessKey)
                    AND Status = 'Active' 
                    LIMIT 1
                ];
                //NOTE we make sure status is active because a user can be found for closed sessions

                if (sessions.isEmpty()) {
                    singleResult.message = 'No MessagingSession found for sessionKey = ' + sessKey;
                    singleResult.success = false;
                    results.add(singleResult);
                    return results;
                }

                MessagingSession session = sessions[0];
                MessagingEndUser endUser = session.MessagingEndUser;

                // If the session somehow doesn't have a MessagingEndUser, handle that
                if (endUser == null) {
                    singleResult.message = 'No MessagingEndUser associated with sessionKey = ' + sessKey;
                    singleResult.success = false;
                    results.add(singleResult); 
                    return results;
                }

                // 2) Check if ContactId and AccountId are already populated
                if (endUser.ContactId != null && endUser.AccountId != null) {
                    singleResult.message = 'ContactId and AccountId are already populated.';
                    singleResult.success = true;
                    singleResult.contactId = endUser.ContactId;
                    singleResult.accountId = endUser.AccountId;
                    results.add(singleResult);  
                    return results;
                }

                // 3) If ContactId or AccountId is null, call out to Okta to retrieve the email
                // for a known and verified user  the plafrom key will stoer their athetication id in MessagingPlatformKey field
                // for Ikta  thai looks like this v2/iamessage/AUTH/extsite/uid:00upkrfnu0Iy3qqyA697
                // Regex to capture everything after "uid:" to the end of the string
                
                Pattern p = Pattern.compile('uid:(.*)$');
                Matcher m = p.matcher(endUser.MessagingPlatformKey);
                
                String userId;
                if (m.find()) {
                    userId = m.group(1);
                    System.debug('UID = ' + userId);
                } else {
                    System.debug('No UID found.');
                }
               
                // If AuthenticatedEndUserId is blank, handle as needed
                if (String.isBlank(userId)) {
                    singleResult.message = 'No AuthenticatedEndUserId on MessagingEndUser.';
                    singleResult.success = false;
                    results.add(singleResult);
                    return results;
                }

                String email = OktaUserApi.getOktaUserEmail(userId);
                if (String.isBlank(email)) {
                    singleResult.message = 'Okta did not return a valid email.';
                    singleResult.success = false;
                    results.add(singleResult);
                    return results;
                }

                // 4) Find a matching Contact by email
                List<Contact> matchingContacts = [
                    SELECT Id, AccountId 
                    FROM Contact
                    WHERE Email = :email
                    LIMIT 1
                ];

                if (matchingContacts.isEmpty()) {
                    singleResult.message = 'No matching Contact found for email: ' + email;
                    singleResult.success = false;
                    results.add(singleResult);
                    return results;
                }

                Contact matchedContact = matchingContacts[0];

                // 5) Update the MessagingEndUser with the found Contact & Account
                endUser.ContactId = matchedContact.Id;
                endUser.AccountId = matchedContact.AccountId;
                update endUser;

                // 6) Set the return fields
                singleResult.message   = 'Successfully updated MessagingEndUser with ContactId & AccountId.';
                singleResult.success   = true;
                singleResult.contactId = endUser.ContactId;
                singleResult.accountId = endUser.AccountId;
            } catch (Exception e) {
                singleResult.message = 'Exception: ' + e.getMessage();
                singleResult.success = false;
            }

            results.add(singleResult);
            

        return results;
    }

    global class SessionRequest {
        @InvocableVariable(required=true)
        global String sessionKey;
    }

    global class InvokeResult {
        @InvocableVariable
        global String sessionKey;

        @InvocableVariable
        global Boolean success;

        @InvocableVariable
        global String message;

        @InvocableVariable
        global string contactId;

        @InvocableVariable
        global string accountId;
    }
}