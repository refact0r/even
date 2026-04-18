import './style.css'
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
} from '@evenrealities/even_hub_sdk'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <section id="center">
    <h1>Even Glasses App</h1>
    <p id="status">Connecting to Even Hub bridge…</p>
  </section>
`

const status = document.querySelector<HTMLParagraphElement>('#status')!

async function main() {
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

  const startUpPage = new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [textContainer],
  })

  const result = await bridge.createStartUpPageContainer(startUpPage)
  status.textContent = `createStartUpPageContainer result: ${result}`
}

main().catch((err) => {
  status.textContent = `Error: ${err?.message ?? err}`
  console.error(err)
})
