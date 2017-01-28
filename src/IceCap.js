import cheerio from 'cheerio';

/**
 * IceCap process HTML template with programmable.
 *
 * @example
 * import IceCap from 'typhonjs-ice-cap';
 *
 * const ice = new IceCap('<p data-ice="name"></p>');
 * ice.text('name', 'Alice');
 * console.log(ice.html); // <p data-ice="name">Alice</p>
 */
export default class IceCap
{
   static get MODE_APPEND() { return 'append'; }

   static get MODE_WRITE() { return 'write'; }

   static get MODE_REMOVE() { return 'remove'; }

   static get MODE_PREPEND() { return 'prepend'; }

   static get CALLBACK_TEXT() { return 'text'; }

   static get CALLBACK_LOAD() { return 'html'; }

   static set debug(v) { this._debug = v; }

   /**
    * Create instance with HTML template.
    *
    * @param {!string}     html -
    *
    * @param {boolean}     autoClose -
    *
    * @param {boolean}     autoDrop -
    *
    * @param {EventProxy}  eventbus -
    */
   constructor(html, { autoClose = true, autoDrop = true } = { autoClose: true, autoDrop: true }, eventbus = void 0)
   {
      if (!html)
      {
         throw new Error('html must be specified.');
      }

      if (typeof html === 'string')
      {
         this._$root = cheerio.load(html).root();
      }
      else if (html.find)
      {
         this._$root = html;
      }

      this._options = { autoClose, autoDrop };

      this._eventbus = eventbus;
   }

   attr(id, key, value, mode = IceCap.MODE_APPEND)
   {
      const nodes = this._nodes(id);
      let transformedValue;

      if (value === null || value === undefined) { value = ''; }

      for (const node of nodes.iterator)
      {
         const currentValue = node.attr(key) || '';

         switch (mode)
         {
            case IceCap.MODE_WRITE:
               transformedValue = value;
               break;

            case IceCap.MODE_APPEND:
               transformedValue = currentValue + value;
               break;

            case IceCap.MODE_REMOVE:
               transformedValue = currentValue.replace(new RegExp(value, 'g'), '');
               break;

            case IceCap.MODE_PREPEND:
               transformedValue = value + currentValue;
               break;

            default:
               throw Error(`unknown mode. mode = "${mode}"`);
         }

         node.attr(key, transformedValue);
      }

      return this;
   }

   get autoClose()
   {
      return this._options.autoClose;
   }

   set autoClose(val)
   {
      this._options.autoClose = val;
   }

   set autoDrop(val)
   {
      this._options.autoDrop = val;
   }

   get autoDrop()
   {
      return this._options.autoDrop;
   }

   close()
   {
      if (!this._$root) { return this; }

      this._html = this._takeHTML();
      this._$root = null;

      return this;
   }

   drop(id, isDrop = true)
   {
      if (!isDrop) { return; }

      const nodes = this._nodes(id);

      nodes.remove();

      return this;
   }

   _filter(nodes)
   {
      const results = [];

      for (let cntr = 0; cntr < nodes.length; cntr++)
      {
         const node = nodes.eq(cntr);
         const length = node.parents('[data-ice-loaded]').length;

         if (length === 0) { results.push(node[0]); }
      }

      const $result = cheerio(results);

      Object.defineProperty($result, 'iterator',
      {
         get: function()
         {
            const nodes = [];

            for (let cntr = 0; cntr < this.length; cntr++) { nodes.push(this.eq(cntr)); }

            return nodes;
         }
      });

      return $result;
   }

   get html()
   {
      if (!this._$root) { return this._html; }

      this._html = this._takeHTML();

      if (this._options.autoClose) { this.close(); }

      return this._html;
   }

   load(id, ice, mode = IceCap.MODE_APPEND)
   {
      let html = '';

      if (ice instanceof IceCap)
      {
         html = ice.html;
      }
      else if (ice)
      {
         html = ice.toString();
      }

      const nodes = this._nodes(id);

      if (this._options.autoDrop && !html)
      {
         nodes.remove();

         return;
      }

      nodes.attr('data-ice-loaded', '1');

      let transformedValue;

      for (const node of nodes.iterator)
      {
         const currentValue = node.html() || '';

         switch (mode)
         {
            case IceCap.MODE_WRITE:
               node.text('');
               transformedValue = html;
               break;

            case IceCap.MODE_APPEND:
               transformedValue = currentValue + html;
               break;

            case IceCap.MODE_REMOVE:
               transformedValue = currentValue.replace(new RegExp(html, 'g'), '');
               break;

            case IceCap.MODE_PREPEND:
               transformedValue = html + currentValue;
               break;

            default:
               throw Error(`unknown mode. mode = "${mode}"`);
         }

         node.html(transformedValue);
      }

      return this;
   }

   loop(id, values, callback)
   {
      if (!Array.isArray(values))
      {
         throw new Error(`values must be array. values = "${values}"`);
      }

      if (['function', 'string'].indexOf(typeof callback) === -1)
      {
         throw new Error(`callback must be function. callback = "${callback}"`);
      }

      if (typeof callback === 'string')
      {
         switch (callback)
         {
            case IceCap.CALLBACK_TEXT:
               callback = (i, value, ice) => { ice.text(id, value); };
               break;

            case IceCap.CALLBACK_LOAD:
               callback = (i, value, ice) => { ice.load(id, value); };
               break;

            default:
               throw Error(`unknown callback. callback = "${callback}"`);
         }
      }

      const nodes = this._nodes(id);

      if (values.length === 0)
      {
         nodes.remove();

         return;
      }

      for (const node of nodes.iterator)
      {
         const results = [];

         for (let j = 0; j < values.length; j++)
         {
            const parent = cheerio.load('<div/>').root();
            const clonedNode = node.clone();
            const textNode = cheerio.load('\n').root();

            parent.append(clonedNode);
            results.push(clonedNode[0]);
            results.push(textNode[0]);

            const ice = new IceCap(parent);

            callback(j, values[j], ice);
         }

         if (node.parent().length)
         {
            node.parent().append(results);
         }
         else
         {
            this._$root.append(results);
         }

         node.remove();
      }

      return this;
   }

   into(id, value, callback)
   {
      const nodes = this._nodes(id);

      if (value === '' || value === null || value === undefined)
      {
         nodes.remove();

         return;
      }
      else if (Array.isArray(value))
      {
         if (value.length === 0)
         {
            nodes.remove();

            return;
         }
      }

      if (typeof callback !== 'function')
      {
         throw new Error(`callback must be function. callback = "${callback}"`);
      }

      for (const node of nodes.iterator)
      {
         callback(value, new IceCap(node));
      }

      return this;
   }

   _nodes(id)
   {
      if (!this._$root) { throw new Error('can not operation after close.'); }
      if (!id) { throw new Error('id must be specified.'); }

      const $nodes = this._$root.find(`[data-ice="${id}"]`);

      const filtered = this._filter($nodes);

      if (filtered.length === 0 && IceCap._debug && this._eventbus)
      {
         this._eventbus.trigger('log:debug', `node not found. id = ${id}`);
      }

      return filtered;
   }

   _takeHTML()
   {
      const loadedNodes = this._$root.find('[data-ice-loaded]').removeAttr('data-ice-loaded');

      const html = this._$root.html();

      loadedNodes.attr('data-ice-loaded', 1);

      return html;
   }

   /**
    * Apply value to DOM that is specified with id.
    *
    * @param {!string} id -
    * @param {string} value -
    * @param {string} [mode=IceCap.MODE_APPEND] -
    *
    * @return {IceCap} self instance.
    */
   text(id, value, mode = IceCap.MODE_APPEND)
   {
      const nodes = this._nodes(id);

      if (this._options.autoDrop && !value)
      {
         nodes.remove();

         return;
      }

      if (value === null || value === undefined) { value = ''; }

      let transformedValue;

      for (const node of nodes.iterator)
      {
         const currentValue = node.text() || '';

         switch (mode)
         {
            case IceCap.MODE_WRITE:
               transformedValue = value;
               break;

            case IceCap.MODE_APPEND:
               transformedValue = currentValue + value;
               break;

            case IceCap.MODE_REMOVE:
               transformedValue = currentValue.replace(new RegExp(value, 'g'), '');
               break;

            case IceCap.MODE_PREPEND:
               transformedValue = value + currentValue;
               break;

            default:
               throw Error(`unknown mode. mode = "${mode}"`);
         }

         node.text(transformedValue);
      }

      return this;
   }
}

/**
 * Wires up Logger on the plugin eventbus.
 *
 * @param {PluginEvent} ev - The plugin event.
 *
 * @see https://www.npmjs.com/package/typhonjs-plugin-manager
 *
 * @ignore
 */
export function onPluginLoad(ev)
{
   const eventbus = ev.eventbus;

   let eventPrepend = '';

   const options = ev.pluginOptions;

   // Apply any plugin options.
   if (typeof options === 'object')
   {
      // If `eventPrepend` is defined then it is prepended before all event bindings.
      if (typeof options.eventPrepend === 'string') { eventPrepend = `${options.eventPrepend}:`; }
   }

   eventbus.on(`${eventPrepend}ice:cap:create`, (html, options = { autoClose: true, autoDrop: true },
    targetEventbus = eventbus) =>
   {
      return new IceCap(html, options, targetEventbus);
   });

   eventbus.on(`${eventPrepend}ice:cap:set:debug`, (debug) => { IceCap.debug = debug; });
}
