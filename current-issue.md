# lite-vimeo-embed: Private Video Support Issue Report

## Executive Summary

The `lite-vimeo-embed` library currently fails to support Vimeo private/unlisted videos that require privacy hash parameters, forcing developers to fall back to regular iframe embeds for these videos. This limitation significantly reduces the library's utility in production applications where private videos are common.

## Current Technical Problem

### Issue Description
When using `lite-vimeo-embed` with private/unlisted Vimeo videos, the library fails to load the video and throws a **404 error** when attempting to fetch video metadata:

```
GET https://vimeo.com/api/v2/video/{VIDEO_ID}.json 404 (Not Found)
```

### Root Cause Analysis
1. **Private videos are not accessible via Vimeo's public API** (`/api/v2/video/{id}.json`)
2. **lite-vimeo-embed relies on this public API** to fetch video metadata (title, duration, thumbnail)
3. **Privacy hash parameter is ignored** - even when provided via the `params` attribute, the library still tries to use the public API

### Impact on User Experience
- Private videos display as broken/non-functional
- Developers must implement manual fallback detection
- Performance benefits of `lite-vimeo-embed` are lost for private videos
- Inconsistent behavior between public and private videos

## Vimeo Private Video Requirements (2024)

### Privacy Hash Format
Private/unlisted Vimeo videos use URLs with privacy hash parameters:
```
https://vimeo.com/{VIDEO_ID}/{PRIVACY_HASH}
https://player.vimeo.com/video/{VIDEO_ID}?h={PRIVACY_HASH}
```

### oEmbed API Support
According to Vimeo's official documentation:

> **For embeddable videos with viewing privacy set to "Unlisted"**, oEmbed requests must include the full unlisted video link with the privacy hash to receive the full oEmbed response. **Requests that lack the unlisted "hash" value will receive a 404 response**.

**Correct oEmbed endpoint for private videos:**
```
https://vimeo.com/api/oembed.json?url=https://vimeo.com/{VIDEO_ID}/{PRIVACY_HASH}
```

## Proposed Solution

### 1. Privacy Hash Detection
Detect when a privacy hash is present in the video URL or provided as a parameter:

```javascript
// Current URL formats to support:
// https://vimeo.com/123456789/abc123def456
// https://player.vimeo.com/video/123456789?h=abc123def456

const hasPrivacyHash = privacyHash || url.includes('/') && url.split('/').length > 4;
```

### 2. API Strategy Selection
Implement conditional API usage based on video privacy:

```javascript
if (hasPrivacyHash) {
    // Use oEmbed API with full URL including hash
    const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}/${privacyHash}`;
} else {
    // Use existing public API v2 for public videos
    const apiUrl = `https://vimeo.com/api/v2/video/${videoId}.json`;
}
```

### 3. Enhanced Parameter Handling
Ensure privacy hash is properly included in iframe src when creating the embedded player:

```javascript
const embedParams = new URLSearchParams(params);
if (privacyHash && !embedParams.has('h')) {
    embedParams.set('h', privacyHash);
}
const iframeSrc = `https://player.vimeo.com/video/${videoId}?${embedParams.toString()}`;
```

## Implementation Requirements

### New Attributes/Properties
```javascript
// Support privacy hash as attribute
<lite-vimeo videoid="123456789" privacy-hash="abc123def456"></lite-vimeo>

// Or detect from full URL
<lite-vimeo video-url="https://vimeo.com/123456789/abc123def456"></lite-vimeo>
```

### API Integration Requirements
1. **oEmbed API support** for private videos with hash parameters
2. **Fallback handling** when oEmbed requests fail
3. **Thumbnail extraction** from oEmbed response for private videos
4. **Metadata parsing** (title, duration, author) from oEmbed response

### Backward Compatibility
- Existing public video functionality must remain unchanged
- New privacy hash support should be additive, not breaking
- Graceful degradation when privacy hash is invalid

## Current Workaround Implementation

We've implemented a workaround that detects private videos and falls back to iframe:

```javascript
const loadVimeoEmbed = async (videoId, privacyHash) => {
  // For private videos, use iframe directly
  // lite-vimeo-embed fails because private videos can't be accessed via public API
  if (privacyHash) {
    return loadVimeoIframe(videoId, privacyHash);
  }

  // For public videos, use lite-vimeo-embed
  // ... existing implementation
};
```

This workaround **eliminates the performance benefits** of `lite-vimeo-embed` for private videos.

## Expected Benefits of Fix

### Performance Improvements
- **Consistent fast loading** for both public and private videos
- **Reduced thumbnail loading time** via oEmbed API
- **Better user experience** with unified behavior

### Developer Experience
- **Single implementation path** for all Vimeo videos
- **No manual fallback detection** required
- **Complete feature parity** between public and private videos

### Production Readiness
- **Support for enterprise use cases** where private videos are common
- **Reliable video embedding** across all privacy settings
- **Future-proof implementation** aligned with Vimeo's API evolution

## Testing Scenarios

### Test Cases to Implement
1. **Public video** (existing functionality)
   - URL: `https://vimeo.com/123456789`
   - Expected: Uses API v2, loads successfully

2. **Private video with hash in URL**
   - URL: `https://vimeo.com/123456789/abc123def456`
   - Expected: Uses oEmbed API, loads successfully

3. **Private video with hash parameter**
   - `videoid="123456789"` + `privacy-hash="abc123def456"`
   - Expected: Uses oEmbed API, loads successfully

4. **Invalid privacy hash**
   - URL: `https://vimeo.com/123456789/invalidhash`
   - Expected: Graceful error handling, fallback behavior

## References

- [Vimeo oEmbed API Documentation](https://developer.vimeo.com/api/oembed/videos)
- [Use oEmbed with private videos – Vimeo Help Center](https://help.vimeo.com/hc/en-us/articles/12427906892689-Use-oEmbed-with-private-videos)
- [Vimeo Player.js Issue #122 - Hash parameter support](https://github.com/vimeo/player.js/issues/122)

---

**Priority: High** - This issue prevents the library from being production-ready for applications that use Vimeo private videos.

**Impact: Breaking** - Core functionality fails for a significant portion of Vimeo's video content.

**Effort: Medium** - Requires API integration changes but follows established patterns.