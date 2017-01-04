/*

    A simple DSL for building HTML templates.

    Any HTML element tag can be used as a function, e.g.:

        const html = require('html')

        html.elements.button('hello')

        html.elements.custom_element('easy enough')

        const div = html.elements.div
        div({
                class:'class names or class.names.with.dots',
                style:'background:green;',
                data_attributes:'no problem',
                content:[div('child 1'),div('child 2')]
            },
            div('child 3'),div('child 4'),
            [
                div('child 5'),
                div('child 6'),
            ]
        )

*/
;(function (global) {
    'use strict';

    console.log('html.js')

    // -------------------------------------------------------------------------

    const { document, Node } = function(){
        if (global.document) {
            return global
        }
        console.log('    server-side')

        const $toString = Symbol('$toString')

        const EMPTY_ELEMENTS = {
            area:true,
            base:true,
            br:true,
            col:true,
            command:true,
            embed:true,
            hr:true,
            img:true,
            input:true,
            keygen:true,
            link:true,
            meta:true,
            param:true,
            source:true,
            track:true,
            wbr:true,
        }

        function addIndent(out, indent, depth) {
            if (typeof(indent) === 'string') {
                out.push('\n')
                out.push(indent.repeat(depth||0))
            }
        }

        class Node {
            constructor() {
                this.childNodes = []
            }
            clone() {
                const clone = JSON.parse(JSON.stringify(this))
                Object.setPrototypeOf(clone, this.prototype)
            }
            appendChild(node) {
                const childNodes = this.childNodes
                if (node instanceof DocumentFragment) {
                    for (let childNode of node.childNodes) {
                        childNodes.push(childNode.clone())
                    }
                } else {
                    childNodes.push(node)
                }
            }
            toString(indent) {
                if (indent === true) {
                    indent = '\t'
                }
                if (typeof(indent) === 'number') {
                    indent = ' '.repeat(indent)
                }
                const out = []
                this[$toString](out, indent, 0)
                return out.join('')
            }
            [$toString](out, indent, depth) {
                for (let childNode of this.childNodes) {
                    childNode[$toString](out, indent, depth)
                }
            }
        }

        class Element extends Node {
            constructor(tag) {
                super()
                this.tag = tag
                this.classList = new Set()
                this.attributes = []
            }
            addEventListener(event, listener) {
                console.err(`cannot assign a server-side function to client-side event '${event}'`)
            }
            setAttribute(key, value) {
                this.attributes[key] = value
            }
            [$toString](out, indent, depth) {
                const tag = this.tag
                out.push(`<${tag}`)
                const classList = this.classList
                if (classList && classList.size > 0) {
                    out.push(' class="')
                    for (let className of classList) {
                        out.push(className)
                        out.push(' ')
                    }
                    out.pop() // discard trailing space
                    out.push('"')
                }
                const attributes = this.attributes
                if (attributes) {
                    for (let key in attributes) {
                        const value = attributes[key]
                        out.push(` ${key.toLowerCase()}="${value}"`)
                    }
                }
                out.push('>')
                if (!EMPTY_ELEMENTS[tag]) {
                    const childNodes = this.childNodes
                    if (childNodes.length) {
                        for (let childNode of childNodes) {
                            addIndent(out, indent, depth + 1)
                            childNode[$toString](out, indent, depth + 1)
                        }
                        addIndent(out, indent, depth)
                    }
                    out.push(`</${tag}>`)
                }
            }
        }

        class Text extends Node {
            constructor(text) {
                super()
                this.text = text
            }
            [$toString](out) {
                out.push(this.text)
            }
        }

        class DocumentFragment extends Node {
        }

        const document = {
            createElement(tag) {
                return new Element(tag)
            },
            createTextNode(text) {
                return new Text(text)
            },
            createDocumentFragment() {
                return new DocumentFragment()
            },
        }
        return { document, Node }
    }()

    // -------------------------------------------------------------------------

    function style(s) {
        if (s) {
            if (typeof(s) === 'string') {
                return s
            }
            if (typeof(s) === 'object') {
                const stream = []
                for (let key in s) {
                    const value = s[key]
                    if (value) {
                        key = key.replace(/_/g,'-')
                        stream.push(`${key}:${value};`)
                    }
                }
                return stream.join('')
            }
        }
    }

    // -------------------------------------------------------------------------

    function addClass(element, className) {
        if (className.match(/[ .]/)) {
            for (let name of className.split(/[ .]/)) {
                if (name.length > 0) {
                    element.classList.add(name)
                }
            }
            return
        }
        element.classList.add(className)
    }

    // -------------------------------------------------------------------------

    function addEventListener(element, key, value) {
        if (key.includes('_')) {
            key = key.replace(/_/g,'-')
        }
        const match = key.match(/^(?:on[-]?)?([\w]+)$/)
        const eventName = match && match[1]
        if (eventName) {
            element.addEventListener(eventName,value)
            return
        }
    }

    // -------------------------------------------------------------------------

    function setAttribute(element, key, value) {
        if (key.includes('_')) {
            key = key.replace(/_/g,'-')
        }
        element.setAttribute(key, value)
    }

    // -------------------------------------------------------------------------

    function setValues(element, key, value) {
        if (key === 'content') {
            addContent(element, value)
            return
        }
        if (key === 'class') {
            addClass(element, value)
            return
        }
        if (typeof(value) === 'function') {
            addEventListener(element, key, value)
            return
        }
        setAttribute(element, key, value)
    }

    // -------------------------------------------------------------------------

    function addContent(element, content) {
        if (content === undefined || content === null) {
            return
        }
        if (content instanceof Node) {
            element.appendChild(content)
            return
        }
        switch (typeof(content)) {
            case 'function': return
            case 'boolean':
            case 'number':
            case 'string': {
                element.appendChild(document.createTextNode(content))
                return
            }
        }
        if (typeof(content[Symbol.iterator]) === 'function') {
            for (let item of content) {
                addContent(element, item)
            }
            return
        }
        for (let key in content) {
            setValues(element,key,content[key])
        }
    }

    // -------------------------------------------------------------------------

    function createElement(tag, ...content) {
        let element = document.createElement(tag)
        addContent(element, content)
        return element
    }

    // -------------------------------------------------------------------------

    const templates = {
        checkbox(...content) {
            let attributes = {type:'checkbox'}
            content = content.filter(item=>{
                if (typeof(item) === 'boolean') {
                    attributes.checked = item
                    return false
                }
                return true
            })
            return createElement('input',attributes,content)
        },
        numberbox(...content) {
            let attributes = {type:'number'}
            content = content.filter(item=>{
                if (typeof(item) === 'number') {
                    attributes.value = item
                    return false
                }
                return true
            })
            return createElement('input',attributes,content)
        },
        textbox(...content) {
            let attributes = {type:'text'}
            content = content.filter(item=>{
                if (typeof(item) === 'string') {
                    attributes.value = item
                    return false
                }
                return true
            })
            return createElement('input',attributes,content)
        },
        fragment(...content) {
            const fragment = document.createDocumentFragment()
            addContent(fragment, content)
            return fragment
        },
        stylesheet(...content) {
            let attributes = {rel:'stylesheet'}
            content = content.filter(item=>{
                if (typeof(item) === 'string') {
                    attributes.href = item
                    return false
                }
                return true
            })
            return createElement('link',attributes,content)
        },
    }

    // -------------------------------------------------------------------------

    const elements = new Proxy(templates,{
        get(elements, tag) {
            tag = tag.toLowerCase()
            if (tag.includes('_')) {
                tag = tag.replace(/_/g,'-')
            }
            let factory = elements[tag]
            if (factory === undefined) {
                factory = (...content)=>{
                    return createElement(tag, content)
                }
                elements[tag] = factory
            }
            return factory
        },
        set(elements, tag, factory) {
            console.error(`cannot set <${tag}>`)
            return false
        },
    })

    // -------------------------------------------------------------------------

    const tags = [
        'a',        'abbr',     'acronym',  'address',    'applet',   'area',
        'article',  'aside',    'audio',    'b',          'base',     'basefont',
        'bdi',      'bdo',      'big',      'blockquote', 'body',     'br',
        'button',   'canvas',   'caption',  'center',     'cite',     'code',
        'col',      'colgroup', 'datalist', 'dd',         'del',      'details',
        'dfn',      'dialog',   'dir',      'div',        'dl',       'dt',
        'em',       'embed',    'fieldset', 'figcaption', 'figure',   'font',
        'footer',   'form',     'frame',    'frameset',   'h1',       'head',
        'header',   'hr',       'html',     'i',          'iframe',   'img',
        'input',    'ins',      'kbd',      'keygen',     'label',    'legend',
        'li',       'link',     'main',     'map',        'mark',     'menu',
        'menuitem', 'meta',     'meter',    'nav',        'noframes', 'noscript',
        'object',   'ol',       'optgroup', 'option',     'output',   'p',
        'param',    'pre',      'progress', 'q',          'rp',       'rt',
        'ruby',     's',        'samp',     'script',     'section',  'select',
        'small',    'source',   'span',     'strike',     'strong',   'style',
        'sub',      'summary',  'sup',      'table',      'tbody',    'td',
        'textarea', 'tfoot',    'th',       'thead',      'time',     'title',
        'tr',       'track',    'tt',       'u',          'ul',       'var',
        'video',    'wbr',
    ]
    for (let tag of tags) {
        elements[tag]
    }

    // -------------------------------------------------------------------------

    const html = {
        elements,
        express(req, res, next) {
            const send = res.send
            res.send=function(body) {
                if (body instanceof Node) {
                    arguments[0] = body.toString()
                }
                send.apply(res, arguments)
            }
            next()
        },
    }

    if (typeof(module) === 'object') {
        module.exports = html
        return
    }
    if (typeof(window) === 'object') {
        window.html = html
        return
    }

}(typeof(window) === 'object' ? window : global))
