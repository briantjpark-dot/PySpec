import * as Y from 'yjs'

import { yCollab } from 'y-codemirror.next'
import { WebsocketProvider } from 'y-websocket'

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { yaml } from '@codemirror/lang-yaml';


let roomName = location.hash.slice(1) // strip the leading '#'
export let isCreator = false
if (!roomName) {
  roomName = crypto.randomUUID()
  history.replaceState(null, '', '#' + roomName)
  isCreator = true
}

export const ydoc = new Y.Doc()
export const provider = new WebsocketProvider(import.meta.env.VITE_COLLAB_WS_URL, roomName, ydoc)
export const yarray = ydoc.getArray('tabs')
let activeTabId = null

// Everything below only runs on the standalone collab-test.html page (it has
// #collab-editor/#collab-tabs/#add-tab-btn). main.js imports ydoc/provider/yarray
// above without triggering any of this test-page DOM wiring.
const collabEditorEl = document.querySelector('#collab-editor')
if (collabEditorEl) {
  const state = EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      yaml(),
    ]
  })

  const view = new EditorView({ state, parent: /** @type {HTMLElement} */ (collabEditorEl) })


  const addTabBtn = document.querySelector('#add-tab-btn')
  addTabBtn.addEventListener('click', () => {
    const tab = new Y.Map() // setting the id, title, and content
    tab.set('id', crypto.randomUUID()) // for a unique id
    tab.set('title', 'untitled')
    tab.set('content', new Y.Text())
    yarray.push([tab]); // because yarray takes an array of items, not a single itself
  })

  // Now mapping the content per tab instead of one master tab like we did w/ const state in pt. 1
  const showTab = (tab) => {
    const content = tab.get('content')
    const state = EditorState.create({
      doc: content.toString(),
      extensions: [
        basicSetup,
        yaml(),
        yCollab(content, provider.awareness)
      ]
    })
    view.setState(state)
  }

  const renderTabs = () => {
    const tabstrip = document.querySelector('#collab-tabs')
    tabstrip.innerHTML = ''
    for (const tab of yarray.toArray()) {  //toArray turns the yarray into a plain js array
      const button = document.createElement('button')
      button.textContent = tab.get('title')
      if (tab.get('id') === activeTabId) {
        button.classList.add('active')
      }
      button.addEventListener('click', () => {
        activeTabId = tab.get('id')
        showTab(tab)
        renderTabs()
      })
      tabstrip.appendChild(button) // putting the button on the screen
    }
  }

  yarray.observe(() => renderTabs())
  renderTabs()
}


