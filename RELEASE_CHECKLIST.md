# Student Hub v1.5.5 Release Checklist

## Source

- [ ] `npm install`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run verify:features`
- [ ] `npm run verify:product`
- [ ] `npm run audit:static`
- [ ] `npm run audit:ux`
- [ ] `npm run verify:buildfix`
- [ ] `npm run audit:quality`
- [ ] `npm run audit:hosting`

## Backend

- [ ] Migrations 001–020 applied
- [ ] RLS test plan executed
- [ ] Storage test executed
- [ ] Auth redirect configured
- [ ] Test accounts verified

## Browser/PWA

- [ ] HTTPS
- [ ] Install prompt
- [ ] Offline cache
- [ ] Outbox retry
- [ ] Service-worker update
- [ ] No horizontal overflow at 320/360/390/430px
- [ ] No fatal console errors

## Security

- [ ] No secret key in frontend
- [ ] Private storage confirmed
- [ ] Cross-class read blocked
- [ ] Cross-class write blocked
- [ ] Operator functions not exposed to students


## Security v1.8.0

```text
[ ] HTTPS only
[ ] Supabase CAPTCHA enabled
[ ] Cloudflare Turnstile hostname restricted to production domains
[ ] Turnstile secret stored only in Supabase
[ ] VITE_CAPTCHA_REQUIRED=true
[ ] VITE_TURNSTILE_SITE_KEY configured
[ ] Confirm Email enabled
[ ] Auth rate limits reviewed
[ ] MFA TOTP challenge tested
[ ] Global sign-out tested
[ ] Generic auth error behavior verified
[ ] Security headers verified
[ ] Client source contains no service-role/secret/private keys
[ ] DDoS/WAF edge protection configured by hosting provider
```
