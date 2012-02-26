# Magnitude of the charge in units of 4πε₀
CHARGE_MAG = 10000.0
POT_INF = 10000.0
# Potential calculations are carried out this many steps at a time.
POT_ITRNS_PER_RUN = 1000
# Though the potentials are calculated in a 640x640 square
# the charges are placed only in a 512x512 square.
SZ = 640
SZ_SQ = SZ*SZ
CHARGE_RAD = 5.0
CHARGE_RAD_SQ = CHARGE_RAD*CHARGE_RAD
DR = 2.0
# Number of field lines coming out of a charge.
# Field lines are calculated, one line at a step.
MAX_LINES = 10
ANGLE_INC = 2*Math.PI/MAX_LINES
floor = Math.floor
sqrt = Math.sqrt
cos = Math.cos
sin = Math.sin
# There are SZ_SQ positions or pixels at which the potentials
# are calculated. g_pos_indx_start stores the position index
# at which the calculation is to be resumed in the next step.
g_pos_indx_start = 0
g_pots = null
g_func = null
g_cur_charge = null
g_cur_charge_indx = null
g_cur_lof_indx = null
g_charges = null
g_charge_count = null
# Array of the field lines 
# Each field line is an array of the vertices
# that make up the field line.
g_lofs = null

potCal = ->
    pos_indx = g_pos_indx_start
    while pos_indx < SZ_SQ
        x = pos_indx % SZ - SZ/2
        y = floor(pos_indx/SZ) - SZ/2
        dx = g_cur_charge.pos.x - x
        dy = g_cur_charge.pos.y - y
        d = sqrt(dx*dx + dy*dy)
        g_pots[pos_indx] += (g_cur_charge.sign*(if d <= 1 then POT_INF else CHARGE_MAG/d))
        if pos_indx > g_pos_indx_start + POT_ITRNS_PER_RUN
            self.postMessage({ status : 'paused' })
            g_pos_indx_start  = pos_indx + 1
            return
        else
            ++pos_indx
    self.postMessage({ status : 'done', output : g_pots })
    return

fieldCal = ->
    # Array of the vertices of a field line.
    lof = []
    charge = g_charges[g_cur_charge_indx]
    factor = charge.sign*DR
    angle = ANGLE_INC*g_cur_lof_indx
    cur_x = charge.pos.x + CHARGE_RAD*cos(angle)
    cur_y = charge.pos.y + CHARGE_RAD*sin(angle)
    itern = 0
    loop
        lof.push(cur_x, cur_y, 0)
        field = fieldAt(cur_x, cur_y)
        cur_x += factor*field.x
        cur_y += factor*field.y
        ++itern
        # vertices are added to a field line until it is outside
        # the 'radius' of another charge or inside the entire
        # region or the number of iterations exceed some limit.
        if ( insideACharge(cur_x, cur_y) or out(cur_x, cur_y) or itern > 8000 )
            break
    g_lofs.push(lof)
    if g_cur_lof_indx < ( MAX_LINES - 1 )
        ++g_cur_lof_indx
    else
        if g_cur_charge_indx < ( g_charge_count - 1 )
            g_cur_lof_indx = 0
            ++g_cur_charge_indx
        else
            self.postMessage({ status : 'done', output : g_lofs })
            return
    self.postMessage( { status : 'paused' } )
    return

fieldAt = (x_pos, y_pos) ->
    net_field_x = 0
    net_field_y = 0
    for charge in g_charges
        f = fieldOfCharge(charge, x_pos, y_pos)
        net_field_x += f.x
        net_field_y += f.y
    norm = sqrt(net_field_x*net_field_x + net_field_y*net_field_y)
    return { x : net_field_x/norm, y : net_field_y/norm }

fieldOfCharge = (charge, x_pos, y_pos) ->
    dx = x_pos - charge.pos.x
    dy = y_pos - charge.pos.y
    d = sqrt(dx*dx + dy*dy)
    factor = charge.sign*CHARGE_MAG/(d*d*d)
    return { x : dx*factor, y : dy*factor }


insideACharge = (x, y) ->
    for charge in g_charges
        dx = x - charge.pos.x
        dy = y - charge.pos.y
        if ( dx*dx + dy*dy < CHARGE_RAD_SQ )
            return true
    return false

out = (x, y) ->
    if ( x > 256 or x < -255 or y > 256 or y < -255 )
        return true
    return false

g_funcs = { 'pot_calc' : potCal, 'field_calc' : fieldCal }

msgHandler = (e) ->
    cmd = e.data.cmd
    data = e.data.data
    switch cmd
        when 'register'
            func_id = data
            g_func = g_funcs[func_id]
        when 'start'
            switch g_func
                when potCal
                    if data.pot?
                        g_pots = data.pot
                    g_cur_charge = data.charge
                    g_pos_indx_start = 0
                when fieldCal
                    g_charges = data
                    g_charge_count = g_charges.length
                    g_lofs = []
                    g_cur_charge_indx = 0
                    g_cur_lof_indx = 0
            g_func()
        when 'continue'
            g_func()
    return


self.addEventListener('message', msgHandler)

