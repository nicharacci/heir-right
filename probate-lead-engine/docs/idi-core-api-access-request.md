# idiCORE API Access Request

## Current State

HeirRight currently has idiCORE portal access for operator-run searches, but Batch/API access is not active. Until IDI issues production API credentials, the app must keep idiCORE in portal/manual-import mode.

Do not enable backend idiCORE automation until IDI provides:

- API Secret
- Site Key
- Company Key
- API documentation and endpoint references
- Rate limits and billing terms
- Sample request/response formats
- Approved-use compliance confirmation

## How HeirRight Should Request Access

1. Send the email below from an approved HeirRight company email address.
2. Send it to `idicoresupport@ididata.com`.
3. Use the subject `Request for idiCORE API Credentials for HeirRight`.
4. Be ready to complete IDI's approved-use review, including GLBA/DPPA criteria if required.
5. Forward any API documentation and credential format details to the implementation team through a private secret handoff. Do not paste production credentials into project docs or tickets.

## Copy-Paste Email

Subject: Request for idiCORE API Credentials for HeirRight

Hi idiCORE Support Team,

I am writing on behalf of HeirRight to request API access for our approved idiCORE account.

We are building an internal HeirRight operations application that automates portions of our probate real estate document preparation workflow. idiCORE would be used as a source in that workflow to help verify property-related parties, potential heirs, relatives, associates, asset details, and contact information connected to active probate real estate matters.

Specifically, we are requesting the production credentials required for backend integration:

- API Secret
- Site Key
- Company Key
- API documentation
- Endpoint references
- Rate limits
- Sample request/response formats
- Any Batch/API access documentation, if applicable

The API would be used only inside HeirRight's internal application by approved business users. The purpose is to reduce manual portal searching, preserve source evidence, support reviewed Discovery packets, and assist with automated document preparation. The system will not expose idiCORE credentials in the browser. Credentials will be stored as backend secrets, and API runs will be permission-gated, logged, and tied to a specific estate/property review file.

The workflow is review-based: idiCORE results would be attached as source evidence for HeirRight's Discovery and Doc Prep process. Our application will use the data to help populate internal discovery records and document-prep fields, while keeping user review and approval gates in place before final document export.

We understand that production API credentials may require verification of approved use-case criteria, including any applicable GLBA and DPPA compliance requirements. Please send us the required compliance questionnaire, documentation checklist, or approval steps so we can complete the review.

Please also confirm whether our current account is eligible for API access or Batch/API access, and whether there are any additional agreements, billing changes, or account settings required before credentials can be issued.

Thank you,

[Your Name]  
HeirRight  
[Phone Number]  
[Email Address]

## Product Behavior Until Credentials Are Issued

- Settings should show idiCORE as portal/manual import only.
- Doc Prep may accept an operator-imported idiCORE report.
- Backend live idiCORE API runs must remain disabled.
- `IDI_CORE_LIVE_RUN_APPROVED` must stay `false`.
- `IDI_CORE_API_TOKEN` should not be set unless the future IDI integration explicitly supports the issued API credential shape.
