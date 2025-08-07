# Database Connection Troubleshooting Guide

## Why Does the Application Stop Working After a While?

The application can stop working after a while due to several database connection issues. This guide explains the causes and solutions.

## Common Causes

### 1. **Connection Timeouts**
- **Problem**: Database connections time out after being idle
- **Symptoms**: Pages load slowly or fail to load, console shows timeout errors
- **Solution**: The connection manager now includes automatic recovery and retry logic

### 2. **Memory Leaks**
- **Problem**: Health check intervals and caches not properly cleaned up
- **Symptoms**: Browser becomes slow, high memory usage
- **Solution**: Added proper cleanup on page unload and automatic cache expiration

### 3. **Network Instability**
- **Problem**: Intermittent network issues causing connection drops
- **Symptoms**: Intermittent failures, some requests work while others fail
- **Solution**: Implemented exponential backoff retry logic

### 4. **Browser Resource Limits**
- **Problem**: Too many concurrent connections or long-running intervals
- **Symptoms**: Browser becomes unresponsive, tabs crash
- **Solution**: Reduced health check frequency and added connection limits

## Recent Improvements

### 1. **Enhanced Connection Management**
- Increased default timeout from 2 seconds to 30 seconds
- Added automatic connection recovery
- Implemented exponential backoff retry logic
- Added proper cleanup on page unload

### 2. **Better Error Handling**
- More detailed error messages
- Automatic retry with exponential backoff
- Connection health monitoring
- Graceful degradation when connections fail

### 3. **Connection Status Indicator**
- Visual indicator in the navbar showing connection status
- Real-time latency monitoring
- Manual connection test button

### 4. **Improved Caching**
- Automatic cache expiration
- Memory leak prevention
- Smarter cache invalidation

## How to Diagnose Issues

### 1. **Check Connection Status**
- Look at the connection status badge in the navbar
- Green = Connected, Yellow = Unstable, Red = Disconnected
- Click the badge to run a manual connection test

### 2. **Monitor Browser Console**
- Open Developer Tools (F12)
- Check for error messages in the Console tab
- Look for connection-related warnings or errors

### 3. **Use Diagnostic Tools**
- Go to Settings page
- Click "Diagnose Profile Issue" button
- Check the console for detailed diagnostic information

## Troubleshooting Steps

### Step 1: Check Connection Status
1. Look at the connection status badge in the navbar
2. If it's red or yellow, click it to run a manual test
3. Check the browser console for error messages

### Step 2: Refresh the Page
1. Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)
2. This will reset the connection manager
3. Check if the issue persists

### Step 3: Clear Browser Cache
1. Open Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Step 4: Check Network Connection
1. Try accessing other websites
2. Check if your internet connection is stable
3. Try switching networks if possible

### Step 5: Check Supabase Status
1. Go to https://status.supabase.com
2. Check if there are any ongoing issues
3. Verify your Supabase project is active

## Prevention Tips

### 1. **Regular Monitoring**
- Keep an eye on the connection status badge
- Monitor browser console for warnings
- Use the diagnostic tools regularly

### 2. **Browser Management**
- Close unused tabs to free up resources
- Restart browser periodically
- Keep browser updated

### 3. **Network Optimization**
- Use a stable internet connection
- Avoid switching networks frequently
- Consider using a wired connection for critical work

## Technical Details

### Connection Manager Features
- **Health Checks**: Every 60 seconds (reduced from 30)
- **Recovery**: Automatic recovery after 3 consecutive failures
- **Retry Logic**: Exponential backoff with max 10-second delays
- **Cache TTL**: 5 minutes with automatic cleanup
- **Timeout**: 30 seconds default (increased from 2 seconds)

### Error Recovery
- **Immediate Retry**: Up to 2 retries with exponential backoff
- **Connection Recovery**: Automatic after 5-second delay
- **Cache Invalidation**: Clears cache when connection fails
- **Graceful Degradation**: Continues operation with cached data when possible

## Support

If you continue to experience issues:

1. **Check the console** for detailed error messages
2. **Use diagnostic tools** in the Settings page
3. **Monitor connection status** in the navbar
4. **Contact support** with specific error messages and diagnostic results

## Environment Variables

Ensure your `.env.local` file contains:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Performance Monitoring

The application now includes:
- Real-time connection monitoring
- Automatic performance logging
- Memory usage tracking
- Connection latency measurement

These improvements should significantly reduce the likelihood of the application stopping to work after extended use. 