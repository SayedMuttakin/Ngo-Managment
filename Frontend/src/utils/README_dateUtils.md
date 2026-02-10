# Date Utils - Bangladesh Timezone Support

This utility provides functions to handle dates in Bangladesh timezone (UTC+6).

## Why We Need This

Your server/system is running in UTC timezone, but all dates should be displayed in Bangladesh time (UTC+6). Without conversion, dates will appear one day earlier when viewed after 6 PM Bangladesh time.

## Functions Available

### `formatBDDateShort(date)`
Formats date as `DD/MM/YYYY` in Bangladesh time
```javascript
import { formatBDDateShort } from '../utils/dateUtils';

// Example usage
<span>Join Date: {formatBDDateShort(member.joinDate)}</span>
// Output: 11/10/2025
```

### `formatBDDateLong(date)`
Formats date as long format (e.g., "11 October 2025")
```javascript
<p>{formatBDDateLong(new Date())}</p>
// Output: 11 October 2025
```

### `formatBDDateTime(date)`
Formats date and time in Bangladesh timezone
```javascript
<p>{formatBDDateTime(order.createdAt)}</p>
// Output: 11/10/2025, 02:30 PM
```

### `getCurrentBDDate()`
Gets current date in Bangladesh timezone as `YYYY-MM-DD`
```javascript
const today = getCurrentBDDate();
// Output: "2025-10-11"
```

### `getCurrentBDDateTime()`
Gets current datetime as Date object in Bangladesh timezone
```javascript
const now = getCurrentBDDateTime();
// Use this instead of new Date() for current time
```

## Migration Guide

Replace all instances of:

### Old Code
```javascript
// ❌ Wrong - shows UTC date
new Date().toLocaleDateString('en-GB')
new Date(member.joinDate).toLocaleDateString('en-US')
```

### New Code
```javascript
// ✅ Correct - shows Bangladesh date
import { formatBDDateShort, getCurrentBDDateTime } from '../utils/dateUtils';

formatBDDateShort(new Date())
formatBDDateShort(member.joinDate)
getCurrentBDDateTime() // instead of new Date()
```

## Files Already Updated

✅ MemberCard.jsx
✅ MembersList.jsx  
✅ DashboardLayout.jsx
✅ CollectionSheet.jsx
✅ dateUtils.js (created)

## Important Notes

1. **Always use these utilities** when displaying dates to users
2. **Server-side dates** are stored in UTC - that's correct, don't change it
3. **Only convert for display** - keep backend dates in UTC
4. The conversion adds 6 hours to UTC time to get Bangladesh time

## Example Scenario

Server time: `2025-10-10 23:00:00 UTC`  
Bangladesh time: `2025-10-11 05:00:00 BST` (UTC+6)

Without conversion: Shows "10/10/2025" ❌  
With conversion: Shows "11/10/2025" ✅
