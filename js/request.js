function makeDeleteButton() {
    return $('<button/>')
        .addClass('delete')
        .click(function() { $(this).closest('.toDelete').remove(); updateUrl(this); })
        .html('<img src="img/delete.svg" class="deleteButton" alt="delete">');
}

function insertPathElt() {
    var key = $('#addPathInput').val();
    $("#path").append(makeKeyValue(key, ''));
    $('#addPathInput').val('');
    $("#path input").last().focus();
}

function insertParam() {
    var key = $('#addParamInput').val();
    $("#parameters").append(makeKeyValue(key, ''));
    $('#addParamInput').val('');
    $("#parameters input").last().focus();
}

function makeTemplatePath(val, input) {
    var templateFilled = false;
    input.closest('.inputDiv').addClass('templateInput');
    input.focus(function() { if (!templateFilled) { this.value=''; } })
        .blur(function() {
            if (templateFilled) { return; }
            if ($(this).val() == val || $(this).val() == '') {
                this.value = val;
            } else {
                $(this).closest('.inputDiv').removeClass('templateInput');
                templateFilled = true;
            }
        });
}

function makeKeyValue(key, val) {
    var res = $('<div/>')
        .addClass('inputDiv')
        .addClass('toDelete')
        .append(' ');

    res.append($('<span/>').addClass('key').text(key));

    var valueElt = $('<input/>')
         .attr('type', 'text')
         .attr('placeholder', 'type your value here')
        .addClass('value')
        .val(val);

    if (isPlaceType(key)) {
        makeAutocomplete(valueElt);
    } else if (isDatetimeType(key)) {
        makeDatetime(valueElt);
    } else if (key == 'coverage') {
        makeCoverageList(val, valueElt);
    }
    var update = function(){ updateUrl(this); }
    valueElt.keyup(update).change(update).focus(update);
    res.append(valueElt);
    res.append(makeDeleteButton());

    // valueElt must be attached to res to call this
    if (isTemplate(val)) { makeTemplatePath(val, valueElt); }

    return res;
}

function getFocusedElemValue(elemToTest, focusedElem, noEncoding) {
    var value = $(elemToTest).is('input') ?
        (noEncoding ? elemToTest.value : elemToTest.value.encodeURI()) :
        $(elemToTest).text();
    if (focusedElem == elemToTest) {
        return '<span class="focus_params" style="color:red">{0}</span>'
            .format(value);
    }
    return value;
}

function makeCoverageList(val, obj) {
    if (val) { $(obj).val(val); }
    
    var api = $("#api input.api").attr('value');
    var token = $('#token input.token').val();
    var request =  api + "/coverage";
    
    $.ajax({
        headers: isUndefined(token) ? {} : { Authorization: "Basic " + btoa(token) },
        dataType: "json",
        url: request,
        success: function(data) {
                var res = [];
                for (var dict in data) {
                    for (var cov = 0; cov < data[dict].length; cov++) {
                        res.push(data[dict][cov].id);
                    }
                    var auto = $(obj).autocomplete({source: res, minLength: 0, scroll: true, delay: 500});
                    auto.focus(function() {
                        auto.autocomplete("search", '');
                    });
                    return auto;
                }
            }
    });
}

function finalUrl(focusedElem) {
    var finalUrl = getFocusedElemValue($('#api input.api')[0], focusedElem, true);
    $("#path .key, #path input.value, #featureInput").each(function(){
        finalUrl += '/' + getFocusedElemValue(this, focusedElem);
    });

    finalUrl += '?';

    $('#parameters .key, #parameters input.value').each(function(){
        finalUrl += getFocusedElemValue(this, focusedElem);
        if ($(this).hasClass('key')) {
            finalUrl += '=';
        }
        if ($(this).hasClass('value')) {
            finalUrl += '&';
        }
    });
    return finalUrl;
}

function submit() {
    var token = $('#token input.token').val();
    var f = finalUrl(); // finalUrl can be called without any args
    window.location = '?request={0}&token={1}'.format(f.encodeURI(), token.encodeURI());
}

function updateUrl(focusedElem) {
    var f = finalUrl(focusedElem);
    $('#urlDynamic span').html(f);
}

function getCoverage() {
    var prevIsCoverage = false;
    var coverage = null;
    var covElt = $("#path .key, #path input.value").each(function() {
        if (prevIsCoverage) {
            coverage = $(this).val();
        }
        prevIsCoverage = $(this).text() == 'coverage';
    });
    return coverage;
} 

function makeAutocomplete(elt) {
    $(elt).autocomplete({
        source: function(request, response) {
            var token = $('#token input.token').val();
            var url = $('#api input.api').val();
            var cov = getCoverage();
            if (cov !== null) {
                url = '{0}/coverage/{1}'.format(url, cov);
            }
            $.ajax({
                url: '{0}/places?q={1}'.format(url, request.term.encodeURI()),
                headers: isUndefined(token) ? {} : { Authorization: "Basic " + btoa(token) },
                success: function(data) {
                    var res = [];
                    if ('places' in data) {
                        data['places'].forEach(function(place) {
                            res.push({ value: place.id, label: place.name });
                        });
                    }
                    response(res);
                },
                error: function() {
                    response([]);
                }
            });
        },
    });
}

function makeDatetime(elt) {
    $(elt).datetimepicker({
        dateFormat: 'yymmdd',
        timeFormat: 'HHmmss',
        timeInput: true,
        separator: 'T',
        controlType: 'select',
        oneLine: true,
    });
}

function parseUrl() {
    var search = new URI(window.location).search(true);
    var request = search['request'];
    if (isUndefined(request)) { return null; }

    var req_uri = new URI(request);
    var api = req_uri.origin();
    var paths = req_uri.path().split('/');
    paths = paths.length == 1 ? [] : paths.slice(1);
    var api_path = [];

    var vxxFound = false;
    paths.forEach(function(r) {
        if (!r) { return; }
        if (vxxFound) {
            api_path.push(r.decodeURI());
        } else {
            api += '/' + r.decodeURI();
            vxxFound = /^v\d+$/.test(r);
        }
    });

    var params = req_uri.search(true);

    var token = search['token'];
    if (isUndefined(token)) { token = getTokenFromStorage(api); }

    return {
        token: token,
        request: request,
        api: api,
        path: api_path,
        query: isUndefined(params) ? {} : params
    };
}

$(document).ready(function() {
    $(".addInput").keyup(function(event) {
        if (event.keyCode == 13) {
            $(this).parent().find("button.add").click();
        }
    });

    var request = parseUrl();
    if (request === null) { return; }
    if (isUndefined(request.token)) { request.token = ''; }
    $("#token input.token").attr('value', request.token);
    $("#api input.api").attr('value', request.api);

    var prevPathElt = null;
    request.path.forEach(function(r) {
        if (prevPathElt === null) {
            prevPathElt = r;
        } else {
            $("#path").append(makeKeyValue(prevPathElt, r));
            prevPathElt = null;
        }
    });
    if (prevPathElt !== null) {
        $('#featureInput').val(prevPathElt);
    }

    var param_elt = $("#parameters");
    for (var key in request.query) {
        var value = request.query[key];
        // a list of params, ex.: forbidded_uris[]
        if (Array.isArray(value)) {
            value.forEach(function(v){
                param_elt.append(makeKeyValue(key.decodeURI(), v.decodeURI()));
            });
        } else {
            param_elt.append(makeKeyValue(key.decodeURI(), value));
        }
    }
    $('#urlDynamic span').text(request.request);
});
