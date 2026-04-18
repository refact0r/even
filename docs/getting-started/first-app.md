# Your First App

## Initialize the SDK

The documentation recommends using an async approach to initialize the SDK. The code example shows:

```typescript
import { waitForEvenAppBridge, EvenAppBridge } from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()
```

An alternative synchronous method is also available, though it should only be used after the bridge has been initialized.

## Create a Page

To display content on the glasses, developers create a text container with specific properties:

```typescript
import { waitForEvenAppBridge, TextContainerProperty } from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()

const textContainer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Hello from G2!',
  isEventCapture: 1,
})

const result = await bridge.createStartUpPageContainer(1, [textContainer])
```

The API returns status codes indicating success or various error conditions.

## Run It

Two deployment options exist: testing with a simulator or deploying to actual hardware through a QR code that users scan with the Even Realities mobile application.

## Recommended Next Steps

The guide directs readers toward learning about display systems, input handling, and design specifications for the 576x288 canvas format.
